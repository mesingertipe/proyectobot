import React, { useState } from 'react';
import { X, Save, Sliders, Bell, Zap, Shield, DollarSign } from 'lucide-react';

export default function SettingsModal({ isOpen, onClose, settings, onSave }) {
  if (!isOpen) return null;

  const [form, setForm] = useState({
    mode: settings?.mode || 'ZEN',
    notification_level: settings?.notification_level || 'MONTHLY',
    is_paper_trading: settings?.is_paper_trading ?? true,
    bot_active: settings?.bot_active ?? true,
    default_leverage: settings?.default_leverage || 5,
    risk_per_trade_pct: settings?.risk_per_trade_pct || 1.5,
    monthly_dca_amount: settings?.monthly_dca_amount || 100
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(5, 10, 20, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '560px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sliders size={22} color="#00e699" />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Ajustes y Parámetros del Bot</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Mode Selector */}
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>
              Modo de Operación (Preset)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                type="button"
                className={form.mode === 'ZEN' ? 'btn-primary' : 'btn-secondary'}
                onClick={() => setForm({ ...form, mode: 'ZEN', notification_level: 'MONTHLY' })}
                style={{ justifyContent: 'center' }}
              >
                🧘 Modo Zen (1h/4h)
              </button>
              <button
                type="button"
                className={form.mode === 'ACTIVE' ? 'btn-primary' : 'btn-secondary'}
                onClick={() => setForm({ ...form, mode: 'ACTIVE', notification_level: 'REALTIME' })}
                style={{ justifyContent: 'center' }}
              >
                ⚡ Modo Activo (15m)
              </button>
            </div>
          </div>

          {/* Notification Level */}
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>
              Notificaciones por Telegram
            </label>
            <select
              value={form.notification_level}
              onChange={(e) => setForm({ ...form, notification_level: e.target.value })}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-glass)',
                color: 'var(--text-main)',
                fontSize: '0.9rem'
              }}
            >
              <option value="SILENT">🔕 Totalmente Silencioso (Sin notificaciones)</option>
              <option value="MONTHLY">📅 Resumen Mensual (Modo Zen Cero Ansiedad)</option>
              <option value="DAILY">🌙 Reporte Diario (Todas las noches a las 10 PM)</option>
              <option value="REALTIME">🔔 Alertas en Tiempo Real (Cada Trade)</option>
            </select>
          </div>

          {/* Risk % Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                Riesgo Máximo por Trade (%)
              </label>
              <span className="mono" style={{ color: '#00e699', fontWeight: 700 }}>{form.risk_per_trade_pct}% de la Cuenta</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="5.0"
              step="0.5"
              value={form.risk_per_trade_pct}
              onChange={(e) => setForm({ ...form, risk_per_trade_pct: parseFloat(e.target.value) })}
              style={{ width: '100%', accentColor: '#00e699' }}
            />
          </div>

          {/* Leverage Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                Apalancamiento BingX Futures
              </label>
              <span className="mono" style={{ color: '#3b82f6', fontWeight: 700 }}>{form.default_leverage}x</span>
            </div>
            <input
              type="range"
              min="3"
              max="20"
              step="1"
              value={form.default_leverage}
              onChange={(e) => setForm({ ...form, default_leverage: parseInt(e.target.value) })}
              style={{ width: '100%', accentColor: '#3b82f6' }}
            />
          </div>

          {/* Paper Mode Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px' }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Modo Simulación (Paper Trading)</span>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Prueba estrategias sin arriesgar capital real en BingX</p>
            </div>
            <input
              type="checkbox"
              checked={form.is_paper_trading}
              onChange={(e) => setForm({ ...form, is_paper_trading: e.target.checked })}
              style={{ width: 18, height: 18, accentColor: '#00e699', cursor: 'pointer' }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary">
              <Save size={16} />
              Guardar Parámetros
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
