from sqlalchemy.orm import Session
from datetime import datetime
from typing import Dict, Any, Optional
from app.bingx.client import BingXClient
from app.bot.risk_manager import RiskManager
from app.notifications.telegram import TelegramNotifier
from app.database.models import TradeRecord, SystemSettings, DailySnapshot

class BotEngine:
    """
    Motor principal de procesamiento de señales de trading, gestión de ordenes y persistencia.
    """

    def __init__(self, db: Session):
        self.db = db
        self.client = BingXClient()

    def get_settings(self) -> SystemSettings:
        settings = self.db.query(SystemSettings).first()
        if not settings:
            settings = SystemSettings()
            self.db.add(settings)
            self.db.commit()
            self.db.refresh(settings)
        return settings

    async def process_signal(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Procesa una señal recibida desde TradingView.
        """
        settings = self.get_settings()

        if not settings.bot_active:
            return {"success": False, "message": "El bot se encuentra desactivado temporalmente."}

        action = str(payload.get("action", "")).upper()
        # Normalizar estados de TradingView (LONG/SHORT/FLAT) a acciones del bot (BUY/SELL/CLOSE)
        if action == "LONG":
            action = "BUY"
        elif action == "SHORT":
            action = "SELL"
        elif action == "FLAT" or "CLOSE" in action:
            action = "CLOSE"
        
        # 0. Normalización estricta de símbolo para BingX (ej: BINGX:XRPUSDT.P -> XRP-USDT)
        raw_symbol = str(payload.get("symbol", "BTC-USDT")).upper()
        if ":" in raw_symbol:
            raw_symbol = raw_symbol.split(":")[-1]
        raw_symbol = raw_symbol.replace(".P", "").replace("/", "").replace("-", "")
        
        # Insertar guión medio para BingX (ej: XRPUSDT -> XRP-USDT)
        if raw_symbol.endswith("USDT") and len(raw_symbol) > 4:
            base_coin = raw_symbol[:-4]
            symbol = f"{base_coin}-USDT"
        else:
            symbol = raw_symbol

        price = float(payload.get("price", 0.0))
        leverage = int(payload.get("leverage", settings.default_leverage))

        # Si TradingView no envía SL/TP en el JSON, calcularlos automáticamente (1.5% SL / 3.0% TP)
        raw_sl = payload.get("stop_loss")
        raw_tp = payload.get("take_profit")

        if "BUY" in action:
            stop_loss = float(raw_sl) if raw_sl else round(price * 0.985, 4)
            take_profit = float(raw_tp) if raw_tp else round(price * 1.030, 4)
        else:
            stop_loss = float(raw_sl) if raw_sl else round(price * 1.015, 4)
            take_profit = float(raw_tp) if raw_tp else round(price * 0.970, 4)

        # 1. Obtener balance de BingX
        balance_resp = await self.client.get_futures_balance()
        account_balance = balance_resp.get("data", {}).get("balance", 100.0)

        # 2. Ajuste de apalancamiento por niveles
        effective_leverage = RiskManager.get_tiered_leverage(account_balance, leverage)
        await self.client.set_leverage(symbol, effective_leverage)

        # 3. Cierre de posición existente si es CLOSE
        if "CLOSE" in action:
            return await self._close_existing_position(symbol, price)

        # 4. Cálculo de tamaño de posición por riesgo dinámico
        sl_for_calc = stop_loss if stop_loss else (price * 0.98 if "BUY" in action else price * 1.02)
        qty, margin, risk_usdt = RiskManager.calculate_position_size(
            account_balance=account_balance,
            entry_price=price,
            stop_loss_price=sl_for_calc,
            risk_pct=settings.risk_per_trade_pct,
            leverage=effective_leverage
        )

        # En BingX Modo Unidireccional (One-Way mode), positionSide debe ser BOTH
        position_side = payload.get("position_side", "BOTH").upper()
        order_side = "BUY" if "BUY" in action else "SELL"

        # 5. Ejecutar orden en BingX / Simulador
        order_resp = await self.client.place_order(
            symbol=symbol,
            side=order_side,
            position_side=position_side,
            type_="MARKET",
            quantity=qty,
            price=price,
            stop_loss=stop_loss,
            take_profit=take_profit,
            is_paper=settings.is_paper_trading
        )

        # Validar si BingX rechazó la orden
        if not order_resp.get("success"):
            err_details = order_resp.get("error", "Error desconocido en BingX")
            print(f"[ENGINE ORDER ERROR] Símbolo: {symbol} | Error: {err_details}")
            return {
                "success": False,
                "symbol": symbol,
                "action": action,
                "message": f"Falló envío de orden a BingX: {err_details}"
            }

        # 5.5 Cerrar cualquier posición abierta previa del mismo símbolo en la BD local
        prev_open_trades = self.db.query(TradeRecord).filter(
            TradeRecord.symbol == symbol,
            TradeRecord.status == "OPEN"
        ).all()

        for old_t in prev_open_trades:
            old_t.status = "CLOSED"
            old_t.closed_at = datetime.utcnow()
            old_t.exit_price = price
            
            is_prev_long = old_t.side == "LONG" or "BUY" in str(old_t.action).upper()
            if is_prev_long:
                raw_pnl = (price - old_t.entry_price) * old_t.quantity
            else:
                raw_pnl = (old_t.entry_price - price) * old_t.quantity

            old_t.pnl = round(raw_pnl, 4)
            old_t.roi_pct = round((raw_pnl / old_t.margin_used) * 100, 2) if old_t.margin_used > 0 else 0.0

        # 6. Registrar en Base de Datos SOLO si fue exitosa
        trade_side = "LONG" if "BUY" in action else "SHORT"
        trade = TradeRecord(
            symbol=symbol,
            action=action,
            side=trade_side,
            leverage=effective_leverage,
            entry_price=price,
            quantity=qty,
            margin_used=margin,
            stop_loss=stop_loss,
            take_profit=take_profit,
            status="OPEN",
            is_paper=settings.is_paper_trading or order_resp.get("is_demo", False),
            opened_at=datetime.utcnow()
        )
        self.db.add(trade)
        self.db.commit()
        self.db.refresh(trade)

        # 7. Notificación Push (Si aplica según nivel configurado)
        await TelegramNotifier.notify_trade(
            symbol=symbol,
            action=action,
            price=price,
            margin=margin,
            notification_level=settings.notification_level
        )

        return {
            "success": True,
            "trade_id": trade.id,
            "symbol": symbol,
            "action": action,
            "quantity": qty,
            "margin_used": margin,
            "leverage": effective_leverage,
            "message": f"Orden {action} ejecutada exitosamente para {symbol}."
        }

    async def _close_existing_position(self, symbol: str, exit_price: float) -> Dict[str, Any]:
        trade = self.db.query(TradeRecord).filter(
            TradeRecord.symbol == symbol,
            TradeRecord.status == "OPEN"
        ).order_by(TradeRecord.opened_at.desc()).first()

        if not trade:
            return {"success": False, "message": f"No se encontró una posición abierta para {symbol}"}

        # Ejecutar cierre de posición real en BingX
        close_resp = await self.client.close_position(symbol)
        if not close_resp.get("success"):
            print(f"[ENGINE CLOSE ERROR] No se pudo cerrar la posición real en BingX para {symbol}: {close_resp.get('error')}")

        trade.exit_price = exit_price
        trade.closed_at = datetime.utcnow()
        trade.status = "CLOSED"

        # Cálculo de PnL simulado
        if trade.side == "LONG":
            raw_pnl = (exit_price - trade.entry_price) * trade.quantity
        else:
            raw_pnl = (trade.entry_price - exit_price) * trade.quantity

        trade.pnl = round(raw_pnl, 2)
        trade.roi_pct = round((raw_pnl / trade.margin_used) * 100, 2) if trade.margin_used > 0 else 0.0

        self.db.commit()

        settings = self.get_settings()
        await TelegramNotifier.notify_trade(
            symbol=symbol,
            action=f"CLOSE_{trade.side}",
            price=exit_price,
            margin=trade.margin_used,
            pnl=trade.pnl,
            notification_level=settings.notification_level
        )

        return {
            "success": True,
            "symbol": symbol,
            "pnl": trade.pnl,
            "roi_pct": trade.roi_pct,
            "message": f"Posición {symbol} cerrada con PnL de {trade.pnl:+.2f} USDT"
        }
