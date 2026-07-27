import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# Cargar variables de entorno desde .env obligatoriamente
load_dotenv()

class Settings(BaseSettings):
    APP_NAME: str = "BingX Trading Bot Engine"
    DEBUG: bool = True
    
    # BingX API Credentials
    BINGX_API_KEY: str = os.getenv("BINGX_API_KEY", "")
    BINGX_SECRET_KEY: str = os.getenv("BINGX_SECRET_KEY", "")
    BINGX_IS_DEMO: bool = os.getenv("BINGX_IS_DEMO", "false").lower() == "true"
    
    # Webhook Security
    WEBHOOK_PASSPHRASE: str = os.getenv("WEBHOOK_PASSPHRASE", "clr_bingx_secret_passphrase_2026")
    
    # Telegram Notifications
    TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    TELEGRAM_CHAT_ID: str = os.getenv("TELEGRAM_CHAT_ID", "")
    
    # Risk & Strategy Defaults
    DEFAULT_LEVERAGE: int = 5
    DEFAULT_RISK_PER_TRADE_PCT: float = 1.5
    DEFAULT_MAX_CONCURRENT_TRADES: int = 3
    DEFAULT_MAX_DAILY_DRAWDOWN_PCT: float = 5.0
    DEFAULT_MAX_MONTHLY_DRAWDOWN_PCT: float = 15.0
    
    class Config:
        env_file = ".env"

settings = Settings()
