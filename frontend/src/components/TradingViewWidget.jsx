import React, { useEffect, useRef, useState } from 'react';
import { BarChart2 } from 'lucide-react';

export default function TradingViewWidget() {
  const containerRef = useRef(null);
  const [symbol, setSymbol] = useState('BINANCE:BTCUSDT');

  const pairs = [
    { label: 'BTC/USDT', value: 'BINANCE:BTCUSDT' },
    { label: 'ETH/USDT', value: 'BINANCE:ETHUSDT' },
    { label: 'SOL/USDT', value: 'BINANCE:SOLUSDT' },
    { label: 'XRP/USDT', value: 'BINANCE:XRPUSDT' },
    { label: 'DOGE/USDT', value: 'BINANCE:DOGEUSDT' },
  ];

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: symbol,
      interval: '60',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'es',
      enable_publishing: false,
      allow_symbol_change: true,
      calendar: false,
      support_host: 'https://www.tradingview.com'
    });

    containerRef.current.appendChild(script);
  }, [symbol]);

  return (
    <div className="glass-card" style={{ height: '540px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChart2 size={18} color="#00e699" />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Gráficos TradingView en Tiempo Real</h3>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {pairs.map((p) => (
            <button
              key={p.value}
              onClick={() => setSymbol(p.value)}
              className={symbol === p.value ? 'btn-primary' : 'btn-secondary'}
              style={{ fontSize: '0.75rem', padding: '4px 10px' }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative', borderRadius: '8px', overflow: 'hidden' }}>
        <div className="tradingview-widget-container" ref={containerRef} style={{ height: '100%', width: '100%' }}></div>
      </div>
    </div>
  );
}
