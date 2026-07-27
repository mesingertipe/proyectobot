from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Dict, Any, List

from app.config import settings
from app.database.db import engine, Base, get_db
from app.database.models import TradeRecord, SystemSettings, DailySnapshot
from app.webhooks.tradingview import router as webhook_router
from app.bingx.client import BingXClient

# Crear tablas en SQLite automáticamente al arrancar
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Backend API para Plataforma de Trading Bot BingX con Dashboard y Notificaciones"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(webhook_router)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "app_name": settings.APP_NAME,
        "is_demo": settings.BINGX_IS_DEMO,
        "mode": "Live & Paper Trading Active"
    }

@app.get("/api/v1/analytics/kpis")
async def get_analytics_kpis(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Retorna los KPIs de rendimiento global (Winrate, PnL total, Profit Factor, Drawdown).
    Combina la base de datos local y las posiciones activas reales de BingX.
    """
    trades = db.query(TradeRecord).filter(TradeRecord.status == "CLOSED").all()
    open_trades = db.query(TradeRecord).filter(TradeRecord.status == "OPEN").all()
    
    bingx_client = BingXClient()
    balance_data = await bingx_client.get_futures_balance()
    pos_data = await bingx_client.get_open_positions()

    data_obj = balance_data.get("data", {})
    if isinstance(data_obj, dict):
        current_balance = float(data_obj.get("balance", 0.0))
    else:
        current_balance = 0.0

    # PnL real desde las posiciones de BingX
    positions = pos_data.get("data", [])
    bingx_real_pnl = sum(float(p.get("realisedProfit", 0.0)) + float(p.get("unrealizedProfit", 0.0)) for p in positions)

    db_pnl = sum(t.pnl for t in trades)
    total_pnl = db_pnl + bingx_real_pnl if db_pnl != 0 else bingx_real_pnl

    total_trades = len(trades) + len(positions)
    wins_db = [t for t in trades if t.pnl > 0]
    wins_pos = [p for p in positions if (float(p.get("realisedProfit", 0.0)) + float(p.get("unrealizedProfit", 0.0))) > 0]
    
    wins_count = len(wins_db) + len(wins_pos)
    losses_count = total_trades - wins_count
    win_rate = (wins_count / total_trades * 100.0) if total_trades > 0 else 0.0

    gross_profits = sum(t.pnl for t in wins_db) + sum(float(p.get("realisedProfit", 0.0)) + float(p.get("unrealizedProfit", 0.0)) for p in wins_pos)
    gross_losses = abs(total_pnl - gross_profits) if total_pnl < gross_profits else 0.0
    profit_factor = (gross_profits / gross_losses) if gross_losses > 0 else (1.0 if gross_profits > 0 else 0.0)

    roi_pct = ((total_pnl / 100.0) * 100.0) if total_pnl != 0 else 0.0

    return {
        "total_balance": round(current_balance, 2),
        "total_pnl_usdt": round(total_pnl, 2),
        "roi_pct": round(roi_pct, 2),
        "win_rate_pct": round(win_rate, 1),
        "total_trades": total_trades,
        "wins_count": wins_count,
        "losses_count": losses_count,
        "profit_factor": round(profit_factor, 2),
        "avg_win_usdt": round(gross_profits / wins_count, 2) if wins_count > 0 else 0.0,
        "avg_loss_usdt": round(gross_losses / losses_count, 2) if losses_count > 0 else 0.0,
        "max_drawdown_pct": 0.0,
        "open_trades_count": len(positions) if positions else len(open_trades)
    }

@app.get("/api/v1/analytics/coins")
async def get_coin_analytics(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Retorna la analítica desglosada moneda por moneda basada en datos reales de BingX y la BD.
    """
    trades = db.query(TradeRecord).all()
    bingx_client = BingXClient()
    pos_data = await bingx_client.get_open_positions()
    positions = pos_data.get("data", [])

    coin_stats = {}
    
    # 1. Procesar posiciones reales de BingX
    for p in positions:
        coin = p.get("symbol", "N/A")
        realized = float(p.get("realisedProfit", 0.0))
        unrealized = float(p.get("unrealizedProfit", 0.0))
        net_pnl = realized + unrealized
        
        if coin not in coin_stats:
            coin_stats[coin] = {"symbol": coin, "total_trades": 0, "wins": 0, "pnl_usdt": 0.0}

        coin_stats[coin]["total_trades"] += 1
        if net_pnl > 0:
            coin_stats[coin]["wins"] += 1
        coin_stats[coin]["pnl_usdt"] += net_pnl

    # 2. Sumar datos locales si aplican
    for t in trades:
        coin = t.symbol
        if coin not in coin_stats:
            coin_stats[coin] = {"symbol": coin, "total_trades": 1, "wins": 1 if t.pnl > 0 else 0, "pnl_usdt": t.pnl}

    breakdown = []
    for c_name, c_data in coin_stats.items():
        total = c_data["total_trades"]
        wr = (c_data["wins"] / total * 100.0) if total > 0 else 0.0
        breakdown.append({
            "symbol": c_name,
            "total_trades": total,
            "pnl_usdt": round(c_data["pnl_usdt"], 2),
            "win_rate_pct": round(wr, 1)
        })

    sorted_coins = sorted(breakdown, key=lambda x: x["pnl_usdt"], reverse=True)
    top_winner = sorted_coins[0] if sorted_coins else {"symbol": "N/A", "pnl_usdt": 0.0}
    top_loser = sorted_coins[-1] if sorted_coins else {"symbol": "N/A", "pnl_usdt": 0.0}

    return {
        "top_winner": top_winner,
        "top_loser": top_loser,
        "coins_breakdown": breakdown
    }

@app.get("/api/v1/trades")
async def get_trades(status: str = "ALL", db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """
    Retorna la lista de posiciones e historial de trades enriquecida con datos en tiempo real de BingX.
    """
    query = db.query(TradeRecord)
    if status != "ALL":
        query = query.filter(TradeRecord.status == status)

    trades = query.order_by(TradeRecord.opened_at.desc()).limit(50).all()

    # Consultar posiciones en vivo de BingX
    bingx_client = BingXClient()
    pos_data = await bingx_client.get_open_positions()
    positions = pos_data.get("data", [])
    pos_dict = {p.get("symbol"): p for p in positions}
    
    result = []
    for t in trades:
        # Determinar lado real (LONG / SHORT)
        real_side = "LONG" if (t.side == "LONG" or "BUY" in str(t.action).upper()) else ("SHORT" if (t.side == "SHORT" or "SELL" in str(t.action).upper()) else "LONG")

        # Si la orden está OPEN y BingX tiene datos en vivo para ese símbolo
        live_pos = pos_dict.get(t.symbol)
        if t.status == "OPEN" and live_pos:
            bingx_pos_side = live_pos.get("positionSide")
            amt = float(live_pos.get("positionAmt", 0))
            if bingx_pos_side == "BOTH":
                real_side = "LONG" if amt >= 0 else "SHORT"
            elif bingx_pos_side in ["LONG", "SHORT"]:
                real_side = bingx_pos_side

            mark_p = float(live_pos.get("markPrice", t.entry_price or 0.0))
            realized = float(live_pos.get("realisedProfit", 0.0))
            unrealized = float(live_pos.get("unrealizedProfit", 0.0))
            net_pnl = round(realized + unrealized, 2)
            roi = round(float(live_pos.get("pnlRatio", 0.0)) * 100.0, 2)
            margin = round(float(live_pos.get("margin", t.margin_used or 0.0)), 2)

            result.append({
                "id": t.id,
                "symbol": t.symbol,
                "action": t.action,
                "side": real_side,
                "leverage": t.leverage,
                "entry_price": t.entry_price,
                "exit_price": mark_p,
                "quantity": t.quantity,
                "margin_used": margin,
                "pnl": net_pnl,
                "roi_pct": roi,
                "status": "OPEN",
                "opened_at": t.opened_at.strftime("%Y-%m-%d %H:%M:%S") if t.opened_at else None,
                "closed_at": None
            })
        else:
            result.append({
                "id": t.id,
                "symbol": t.symbol,
                "action": t.action,
                "side": real_side,
                "leverage": t.leverage,
                "entry_price": t.entry_price,
                "exit_price": t.exit_price,
                "quantity": t.quantity,
                "margin_used": t.margin_used,
                "pnl": t.pnl,
                "roi_pct": t.roi_pct,
                "status": t.status,
                "opened_at": t.opened_at.strftime("%Y-%m-%d %H:%M:%S") if t.opened_at else None,
                "closed_at": t.closed_at.strftime("%Y-%m-%d %H:%M:%S") if t.closed_at else None
            })

    return result

@app.get("/api/v1/settings")
def get_settings_endpoint(db: Session = Depends(get_db)) -> Dict[str, Any]:
    settings_obj = db.query(SystemSettings).first()
    if not settings_obj:
        settings_obj = SystemSettings()
        db.add(settings_obj)
        db.commit()
        db.refresh(settings_obj)

    return {
        "mode": settings_obj.mode,
        "notification_level": settings_obj.notification_level,
        "is_paper_trading": settings_obj.is_paper_trading,
        "bot_active": settings_obj.bot_active,
        "monthly_dca_amount": settings_obj.monthly_dca_amount,
        "default_leverage": settings_obj.default_leverage,
        "risk_per_trade_pct": settings_obj.risk_per_trade_pct,
        "max_concurrent_trades": settings_obj.max_concurrent_trades,
        "max_daily_drawdown_pct": settings_obj.max_daily_drawdown_pct,
        "max_monthly_drawdown_pct": settings_obj.max_monthly_drawdown_pct
    }

@app.post("/api/v1/settings")
def update_settings_endpoint(new_settings: Dict[str, Any], db: Session = Depends(get_db)) -> Dict[str, Any]:
    settings_obj = db.query(SystemSettings).first()
    if not settings_obj:
        settings_obj = SystemSettings()
        db.add(settings_obj)

    if "mode" in new_settings:
        settings_obj.mode = new_settings["mode"]
    if "notification_level" in new_settings:
        settings_obj.notification_level = new_settings["notification_level"]
    if "is_paper_trading" in new_settings:
        settings_obj.is_paper_trading = bool(new_settings["is_paper_trading"])
    if "bot_active" in new_settings:
        settings_obj.bot_active = bool(new_settings["bot_active"])
    if "monthly_dca_amount" in new_settings:
        settings_obj.monthly_dca_amount = float(new_settings["monthly_dca_amount"])
    if "default_leverage" in new_settings:
        settings_obj.default_leverage = int(new_settings["default_leverage"])
    if "risk_per_trade_pct" in new_settings:
        settings_obj.risk_per_trade_pct = float(new_settings["risk_per_trade_pct"])
    if "max_concurrent_trades" in new_settings:
        settings_obj.max_concurrent_trades = int(new_settings["max_concurrent_trades"])
    if "max_daily_drawdown_pct" in new_settings:
        settings_obj.max_daily_drawdown_pct = float(new_settings["max_daily_drawdown_pct"])
    if "max_monthly_drawdown_pct" in new_settings:
        settings_obj.max_monthly_drawdown_pct = float(new_settings["max_monthly_drawdown_pct"])

    db.commit()
    db.refresh(settings_obj)
    return {"success": True, "message": "Configuración actualizada correctamente.", "settings": get_settings_endpoint(db)}
