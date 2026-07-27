import React from 'react';
import { Bot, Sliders, ShieldCheck, Zap, Bell, Moon } from 'lucide-react';

export default function Header({ settings, onOpenSettings, onOpenPineExporter }) {
  const isZen = settings?.mode === 'ZEN';

  return (
    <header className="glass-card" style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: 'linear-gradient(135deg, #00e699 0%, #008055 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 15px rgba(0, 230, 153, 0.4)'
        }}>
          <Bot size={24} color="#051610" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.5px' }}>CLR BingX Quant Bot</h1>
            <span className="badge badge-success">
              <span className="pulse-dot"></span>
              {settings?.is_paper_trading ? 'Simulación / Paper Mode' : 'Live BingX Futures'}
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
            Operación Algorítmica Automática &amp; Plan de Gestión a 10 Años
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Preset Badge */}
        <span className={`badge ${isZen ? 'badge-blue' : 'badge-success'}`}>
          {isZen ? <Moon size={13} /> : <Zap size={13} />}
          {isZen ? 'Modo Zen (1h/4h)' : 'Modo Activo (15m)'}
        </span>

        <button 
          className="btn-secondary" 
          onClick={async () => {
            try {
              const res = await fetch('/api/v1/tradingview/webhook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  passphrase: 'clr_bingx_secret_passphrase_2026',
                  action: 'BUY',
                  symbol: 'BTC-USDT',
                  price: 65200.0,
                  leverage: 5
                })
              });
              const data = await res.json();
              alert('🧪 Señal de Prueba Enviada Exitosamente!\n' + JSON.stringify(data, null, 2));
              window.location.reload();
            } catch (err) {
              alert('Error al simular señal: ' + err.message);
            }
          }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', background: 'rgba(0, 230, 153, 0.15)', border: '1px solid var(--accent-green)', color: '#00e699' }}
        >
          <Zap size={16} />
          🧪 Simular Señal
        </button>

        <button className="btn-secondary" onClick={onOpenPineExporter} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
          <ShieldCheck size={16} />
          Estrategias PineScript
        </button>

        <button className="btn-primary" onClick={onOpenSettings} style={{ fontSize: '0.85rem' }}>
          <Sliders size={16} />
          Ajustes Bot
        </button>
      </div>
    </header>
  );
}
