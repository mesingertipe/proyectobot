import React from 'react';
import { DollarSign, TrendingUp, Award, Activity, AlertTriangle } from 'lucide-react';

export default function KPICards({ kpis }) {
  if (!kpis) return null;

  const cards = [
    {
      title: 'Saldo Total Cuenta',
      value: `$${kpis.total_balance < 1 && kpis.total_balance > 0 ? kpis.total_balance?.toFixed(4) : kpis.total_balance?.toFixed(2)} USDT`,
      subtitle: `Inicial: $100.00 USDT | Aporte: +$100/mes`,
      icon: DollarSign,
      color: '#00e699',
      badge: `${kpis.roi_pct >= 0 ? '+' : ''}${kpis.roi_pct}% ROI`
    },
    {
      title: 'Utilidad Neta (PnL)',
      value: `${kpis.total_pnl_usdt >= 0 ? '+' : ''}$${kpis.total_pnl_usdt?.toFixed(2)} USDT`,
      subtitle: `${kpis.wins_count} Ganados / ${kpis.losses_count} Perdidos`,
      icon: TrendingUp,
      color: kpis.total_pnl_usdt >= 0 ? '#00e699' : '#ff4d6d',
      badge: `${kpis.total_trades} Trades Totales`
    },
    {
      title: 'Porcentaje de Victorias',
      value: `${kpis.win_rate_pct}%`,
      subtitle: `Prom. Gana: +$${kpis.avg_win_usdt} | Pierde: -$${kpis.avg_loss_usdt}`,
      icon: Award,
      color: '#3b82f6',
      badge: 'Win Rate'
    },
    {
      title: 'Factor de Beneficio',
      value: `${kpis.profit_factor}x`,
      subtitle: `Ganancias Brutas / Pérdidas Brutas`,
      icon: Activity,
      color: '#ffb703',
      badge: kpis.profit_factor > 1.5 ? 'Excelente' : 'Normal'
    },
    {
      title: 'Caída Máxima (Drawdown)',
      value: `-${kpis.max_drawdown_pct}%`,
      subtitle: `Límite Máximo Permitido: 15.0%`,
      icon: AlertTriangle,
      color: '#a855f7',
      badge: 'Bajo Control'
    }
  ];

  return (
    <div className="kpi-grid">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div key={i} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{c.title}</span>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: `${c.color}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Icon size={18} color={c.color} />
              </div>
            </div>

            <div style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
              {c.value}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{c.subtitle}</span>
              <span className="badge badge-blue" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>{c.badge}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
