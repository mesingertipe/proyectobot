from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Dict, Any
import json
from app.database.db import get_db, SessionLocal
from app.bot.engine import BotEngine
from app.config import settings

router = APIRouter(prefix="/api/v1/tradingview", tags=["TradingView Webhooks"])

class WebhookSignal(BaseModel):
    passphrase: str
    action: str                        # BUY, SELL, CLOSE_LONG, CLOSE_SHORT
    symbol: str                        # BTC-USDT or XRP-USDT
    price: float
    leverage: Optional[int] = 5
    margin_type: Optional[str] = "ISOLATED"
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None

async def process_signal_background(signal_dict: dict):
    db = SessionLocal()
    try:
        engine = BotEngine(db)
        res = await engine.process_signal(signal_dict)
        print(f"[BACKGROUND SIGNAL COMPLETED]: {res}")
    except Exception as e:
        print(f"[BACKGROUND ENGINE ERROR]: {e}")
    finally:
        db.close()

@router.post("/webhook")
async def receive_tradingview_signal(
    request: Request, 
    background_tasks: BackgroundTasks
):
    """
    Endpoint principal para recibir alertas desde TradingView y responder INMEDIATAMENTE (< 15ms).
    La orden en BingX se ejecuta en segundo plano para evitar timeouts en TradingView.
    """
    body_bytes = await request.body()
    body_str = body_bytes.decode("utf-8").strip()

    # Si TradingView envió comillas envolventes o string en vez de JSON
    if (body_str.startswith('"') and body_str.endswith('"')) or (body_str.startswith("'{") and body_str.endswith("}'")):
        body_str = body_str.strip('"').strip("'")

    try:
        data = json.loads(body_str)
        if isinstance(data, str):
            data = json.loads(data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Formato JSON no válido recibido: {str(e)}")

    try:
        signal = WebhookSignal(**data)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Parámetros de señal incompletos o inválidos: {str(e)}")

    # 1. Validar clave secreta (passphrase)
    if signal.passphrase != settings.WEBHOOK_PASSPHRASE:
        raise HTTPException(status_code=401, detail="Passphrase de Webhook no válida.")

    # 2. Encolar la ejecución en segundo plano y responder INSTANTÁNEAMENTE a TradingView
    background_tasks.add_task(process_signal_background, signal.dict())

    return {
        "success": True,
        "status": "queued",
        "message": f"Señal {signal.action} para {signal.symbol} recibida correctamente. Procesando en BingX en segundo plano."
    }
