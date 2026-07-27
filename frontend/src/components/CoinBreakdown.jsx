import React from 'react';
import { Trophy, TrendingDown, Coins } from 'lucide-react';

export default function CoinBreakdown({ coinData }) {
  if (!coinData) return null;

  const topWinner = coinData.top_winner || { symbol: 'SOL-USDT', pnl_usdt: 12.50 };
  const topLoser = coinData.top_loser || { symbol: 'DOGE-USDT', pnl_usdt: -1.20 };
  const coins = coinData.coins_breakdown || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Winner & Loser Highlights */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="glass-card" style={{ background: 'rgba(0, 230, 153, 0.05)', borderColor: 'rgba(0, 230, 153, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Trophy size={18} color="#00e699" />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#00e699' }}>Moneda Más Ganadora</span>
          </div>
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>{topWinner.symbol}</span>
            <span className="mono" style={{ fontSize: '1rem', color: '#00e699', fontWeight: 700 }}>
              +${topWinner.pnl_usdt?.toFixed(2)} USDT
            </span>
          </div>
        </div>

        <div className="glass-card" style={{ background: 'rgba(255, 77, 109, 0.05)', borderColor: 'rgba(255, 77, 109, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingDown size={18} color="#ff4d6d" />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ff4d6d' }}>Moneda Mayor Pérdida</span>
          </div>
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>{topLoser.symbol}</span>
            <span className="mono" style={{ fontSize: '1rem', color: topLoser.pnl_usdt < 0 ? '#ff4d6d' : '#00e699', fontWeight: 700 }}>
              ${topLoser.pnl_usdt?.toFixed(2)} USDT
            </span>
          </div>
        </div>
      </div>

      {/* Multi-coin Detailed Table */}
      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Coins size={18} color="#3b82f6" />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Rendimiento Detallado por Moneda</h3>
        </div>

        <table className="custom-table">
          <thead>
            <tr>
              <th>Par (Symbol)</th>
              <th>Trades</th>
              <th>Win Rate %</th>
              <th>PnL Neto (USDT)</th>
            </tr>
          </thead>
          <tbody>
            {coins.map((c, idx) => (
              <tr key={idx}>
                <td style={{ fontWeight: 700 }}>{c.symbol}</td>
                <td>{c.total_trades}</td>
                <td>
                  <span className={`badge ${c.win_rate_pct >= 65 ? 'badge-success' : 'badge-blue'}`}>
                    {c.win_rate_pct}%
                  </span>
                </td>
                <td className="mono" style={{ fontWeight: 700, color: c.pnl_usdt >= 0 ? '#00e699' : '#ff4d6d' }}>
                  {c.pnl_usdt >= 0 ? '+' : ''}${c.pnl_usdt?.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
