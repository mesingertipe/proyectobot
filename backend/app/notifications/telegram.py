import httpx
from typing import Dict, Any, Optional
from app.config import settings

class TelegramNotifier:
    """
    Gestor de Notificaciones Push a Telegram (Silencioso, Mensual, Diario, Tiempo Real).
    """

    @staticmethod
    async def send_message(text: str, chat_id: Optional[str] = None, token: Optional[str] = None) -> bool:
        bot_token = token or settings.TELEGRAM_BOT_TOKEN
        target_chat = chat_id or settings.TELEGRAM_CHAT_ID

        if not bot_token or not target_chat:
            # Si no hay token de Telegram configurado, solo registra en logs de forma segura para Windows
            try:
                print(f"[TELEGRAM LOG (Simulado)]: {text}")
            except UnicodeEncodeError:
                print(f"[TELEGRAM LOG (Simulado)]: {text.encode('ascii', 'ignore').decode('ascii')}")
            return True

        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = {
            "chat_id": target_chat,
            "text": text,
            "parse_mode": "Markdown"
        }

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(url, json=payload, timeout=5.0)
                return resp.status_code == 200
        except Exception as e:
            print(f"[TELEGRAM ERROR]: {e}")
            return False

    @classmethod
    async def notify_trade(cls, symbol: str, action: str, price: float, margin: float, pnl: Optional[float] = None, notification_level: str = "REALTIME"):
        if notification_level not in ["REALTIME", "DAILY"]:
            return  # En modo SILENT o MONTHLY no molesta con trades individuales

        emoji = "🟢" if "BUY" in action or "LONG" in action else "🔴"
        if pnl is not None:
            result_emoji = "🎯" if pnl >= 0 else "🔻"
            msg = (
                f"{result_emoji} *Operación Cerrada en BingX*\n\n"
                f"• *Par*: `{symbol}`\n"
                f"• *Acción*: `{action}`\n"
                f"• *Precio*: `${price:,.2f}`\n"
                f"• *Resultado*: `${pnl:+,.2f} USDT`"
            )
        else:
            msg = (
                f"{emoji} *Nueva Operación Ejecutada en BingX*\n\n"
                f"• *Par*: `{symbol}`\n"
                f"• *Acción*: `{action}`\n"
                f"• *Precio*: `${price:,.2f}`\n"
                f"• *Margen*: `${margin:,.2f} USDT`"
            )

        await cls.send_message(msg)

    @classmethod
    async def notify_monthly_report(cls, balance: float, monthly_pnl: float, roi_pct: float, top_winner: str, top_loser: str):
        emoji = "📈" if monthly_pnl >= 0 else "📉"
        msg = (
            f"📊 *REPORTE EJECUTIVO MENSUAL - BINGX BOT*\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"• *Saldo Actual*: `${balance:,.2f} USDT`\n"
            f"• *Utilidad del Mes*: `{monthly_pnl:+,.2f} USDT` ({roi_pct:+.2f}%)\n"
            f"• *Moneda Más Rentable*: 🥇 `{top_winner}`\n"
            f"• *Moneda Menos Rentable*: ⚠️ `{top_loser}`\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"✨ _Tu plan a 10 años continúa ejecutándose con éxito en modo automatizado._"
        )
        await cls.send_message(msg)
