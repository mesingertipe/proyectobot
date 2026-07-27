from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text
from datetime import datetime
from app.database.db import Base

class TradeRecord(Base):
    __tablename__ = "trade_records"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, index=True)               # e.g., BTC-USDT
    action = Column(String)                           # BUY, SELL, CLOSE_LONG, CLOSE_SHORT
    side = Column(String)                             # LONG, SHORT
    leverage = Column(Integer, default=5)
    entry_price = Column(Float)
    exit_price = Column(Float, nullable=True)
    quantity = Column(Float)
    margin_used = Column(Float)
    stop_loss = Column(Float, nullable=True)
    take_profit = Column(Float, nullable=True)
    pnl = Column(Float, default=0.0)                  # Net profit/loss in USDT
    roi_pct = Column(Float, default=0.0)              # Return on investment %
    status = Column(String, default="OPEN")           # OPEN, CLOSED, CANCELLED
    is_paper = Column(Boolean, default=True)
    opened_at = Column(DateTime, default=datetime.utcnow)
    closed_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)

class DailySnapshot(Base):
    __tablename__ = "daily_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(String, index=True)                 # YYYY-MM-DD
    total_balance = Column(Float)
    available_margin = Column(Float)
    pnl_daily = Column(Float)
    pnl_daily_pct = Column(Float)
    trades_count = Column(Integer, default=0)
    wins_count = Column(Integer, default=0)
    losses_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

class SystemSettings(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    mode = Column(String, default="ZEN")               # ZEN vs ACTIVE
    notification_level = Column(String, default="MONTHLY") # SILENT, MONTHLY, DAILY, REALTIME
    is_paper_trading = Column(Boolean, default=True)
    bot_active = Column(Boolean, default=True)
    monthly_dca_amount = Column(Float, default=100.0)
    default_leverage = Column(Integer, default=5)
    risk_per_trade_pct = Column(Float, default=1.5)
    max_concurrent_trades = Column(Integer, default=3)
    max_daily_drawdown_pct = Column(Float, default=5.0)
    max_monthly_drawdown_pct = Column(Float, default=15.0)
    updated_at = Column(DateTime, default=datetime.utcnow)
