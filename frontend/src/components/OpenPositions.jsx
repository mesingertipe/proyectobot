import React, { useState } from 'react';
import { ListFilter, ArrowUpRight, ArrowDownRight, Filter } from 'lucide-react';

export default function OpenPositions({ trades }) {
  const [selectedCoin, setSelectedCoin] = useState('ALL');

  if (!trades) return null;

  // Extraer lista única de monedas en el historial
  const availableCoins = ['ALL', ...new Set(trades.map(t => t.symbol))];

  const filteredTrades = selectedCoin === 'ALL' 
    ? trades 
    : trades.filter(t => t.symbol === selectedCoin);

  return (
    <div className="glass-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ListFilter size={18} color="#00e699" />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Posiciones e Historial de Operaciones</h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Selector de Filtro por Moneda */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
            <Filter size={14} color="var(--text-muted)" />
            <select
              value={selectedCoin}
              onChange={(e) => setSelectedCoin(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-main)',
                fontSize: '0.8rem',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="ALL" style={{ background: '#090d16' }}>🔍 Todas las Monedas</option>
              {availableCoins.filter(c => c !== 'ALL').map(coin => (
                <option key={coin} value={coin} style={{ background: '#090d16' }}>
                  {coin}
                </option>
              ))}
            </select>
          </div>

          <span className="badge badge-blue">{filteredTrades.length} Registros</span>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="custom-table">
          <thead>
            <tr>
              <th>Par</th>
              <th>Lado</th>
              <th>Apalancamiento</th>
              <th>Entrada</th>
              <th>Salida / Actual</th>
              <th>Margen (USDT)</th>
              <th>PnL (USDT)</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filteredTrades.map((t) => {
              const isLong = t.side === 'LONG' || t.action?.includes('BUY');
              const isWin = t.pnl > 0;
              const isLoss = t.pnl < 0;

              return (
                <tr key={t.id}>
                  <td style={{ fontWeight: 700 }}>{t.symbol}</td>
                  <td>
                    <span className={`badge ${isLong ? 'badge-success' : 'badge-danger'}`} style={{ gap: 4 }}>
                      {isLong ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                      {isLong ? 'LONG' : 'SHORT'}
                    </span>
                  </td>
                  <td className="mono">{t.leverage}x</td>
                  <td className="mono">${t.entry_price?.toLocaleString()}</td>
                  <td className="mono">
                    ${t.exit_price ? t.exit_price.toLocaleString() : 'En Ejecución'}
                    {t.status === 'OPEN' && <span style={{ fontSize: '0.7rem', color: '#93c5fd', marginLeft: 4 }}>(En Vivo)</span>}
                  </td>
                  <td className="mono">${t.margin_used?.toFixed(2)}</td>
                  <td className="mono" style={{ fontWeight: 700, color: isWin ? '#00e699' : (isLoss ? '#ff4d6d' : 'var(--text-muted)') }}>
                    {t.pnl !== null && t.pnl !== undefined 
                      ? `${t.pnl >= 0 ? '+' : ''}$${t.pnl.toFixed(2)} (${t.roi_pct > 0 ? '+' : ''}${t.roi_pct}%)` 
                      : '---'}
                  </td>
                  <td>
                    <span className={`badge ${t.status === 'OPEN' ? 'badge-blue' : 'badge-success'}`}>
                      {t.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
