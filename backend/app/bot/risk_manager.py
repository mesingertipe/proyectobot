from typing import Dict, Any, Tuple
from app.database.models import SystemSettings

class RiskManager:
    """
    Motor de Gestión de Riesgo, Cálculo de Margen, Auto-Compounding (Interés Compuesto)
    y Cortacircuitos de Pérdida Máxima.
    """

    @staticmethod
    def calculate_position_size(
        account_balance: float,
        entry_price: float,
        stop_loss_price: float,
        risk_pct: float = 1.5,
        leverage: int = 5
    ) -> Tuple[float, float, float]:
        """
        Calcula el tamaño exacto de posición en cantidad del activo, margen requerido y riesgo en USDT.
        
        Retorna: (quantity, margin_required, risk_amount_usdt)
        """
        if account_balance <= 0 or entry_price <= 0:
            return 0.0, 0.0, 0.0

        # Riesgo máximo por operación en USDT (ej: 1.5% de $100 = $1.50)
        risk_amount_usdt = account_balance * (risk_pct / 100.0)

        # Distancia porcentual al Stop Loss
        price_distance = abs(entry_price - stop_loss_price)
        if price_distance <= 0:
            # Fallback a 2% de distancia si no se especifica SL
            price_distance = entry_price * 0.02

        loss_per_unit = price_distance

        # Cantidad de contratos / unidades a comprar
        quantity = risk_amount_usdt / loss_per_unit

        # Nocional total = Cantidad * Precio de Entrada
        notional_value = quantity * entry_price

        # Margen requerido en USDT = Nocional / Apalancamiento
        margin_required = notional_value / leverage

        # Protección: No usar más del 25% del saldo disponible en una sola posición
        max_allowed_margin = account_balance * 0.25
        if margin_required > max_allowed_margin:
            margin_required = max_allowed_margin
            notional_value = margin_required * leverage
            quantity = notional_value / entry_price

        return round(quantity, 4), round(margin_required, 2), round(risk_amount_usdt, 2)

    @staticmethod
    def get_tiered_leverage(account_balance: float, base_leverage: int = 5) -> int:
        """
        Escalado progresivo de apalancamiento según el nivel de capital (Plan 10 Años).
        - $100 - $1,000: 5x a 10x
        - $1,000 - $10,000: 3x a 5x
        - $10,000+: 2x a 3x
        """
        if account_balance >= 10000:
            return min(base_leverage, 3)
        elif account_balance >= 1000:
            return min(base_leverage, 5)
        else:
            return base_leverage

    @staticmethod
    def check_circuit_breaker(
        daily_loss_pct: float,
        monthly_loss_pct: float,
        settings: SystemSettings
    ) -> Tuple[bool, str]:
        """
        Verifica si se ha alcanzado el límite de pérdida diaria o mensual (Freno de mano).
        """
        if daily_loss_pct >= settings.max_daily_drawdown_pct:
            return True, f"Cortacircuitos activado: Pérdida diaria de {daily_loss_pct:.1f}% superó el límite de {settings.max_daily_drawdown_pct}%"
        
        if monthly_loss_pct >= settings.max_monthly_drawdown_pct:
            return True, f"Cortacircuitos activado: Pérdida mensual de {monthly_loss_pct:.1f}% superó el límite de {settings.max_monthly_drawdown_pct}%"

        return False, "OK"
