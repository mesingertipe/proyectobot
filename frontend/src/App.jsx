import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import KPICards from './components/KPICards';
import CoinBreakdown from './components/CoinBreakdown';
import OpenPositions from './components/OpenPositions';
import TradingViewWidget from './components/TradingViewWidget';
import SettingsModal from './components/SettingsModal';
import PineScriptExporter from './components/PineScriptExporter';

export default function App() {
  const [kpis, setKpis] = useState(null);
  const [coinData, setCoinData] = useState(null);
  const [trades, setTrades] = useState([]);
  const [settings, setSettings] = useState({
    mode: 'ZEN',
    notification_level: 'MONTHLY',
    is_paper_trading: true,
    default_leverage: 5,
    risk_per_trade_pct: 1.5
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPineExporterOpen, setIsPineExporterOpen] = useState(false);

  // Cargar datos desde la API
  const fetchData = async () => {
    try {
      const [kpiRes, coinRes, tradeRes, settingsRes] = await Promise.all([
        fetch('/api/v1/analytics/kpis').then(r => r.json()),
        fetch('/api/v1/analytics/coins').then(r => r.json()),
        fetch('/api/v1/trades').then(r => r.json()),
        fetch('/api/v1/settings').then(r => r.json())
      ]);

      setKpis(kpiRes);
      setCoinData(coinRes);
      setTrades(tradeRes);
      setSettings(settingsRes);
    } catch (e) {
      console.warn("API offline or loading error:", e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Refrescar cada 10 segundos
    return () => clearInterval(interval);
  }, []);

  const handleSaveSettings = async (newSettings) => {
    try {
      const res = await fetch('/api/v1/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      const data = await res.json();
      if (data.settings) {
        setSettings(data.settings);
      } else {
        setSettings(newSettings);
      }
      fetchData();
    } catch (e) {
      console.error("Error guardando ajustes:", e);
      setSettings(newSettings);
    }
  };

  return (
    <div className="app-container">
      <Header
        settings={settings}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenPineExporter={() => setIsPineExporterOpen(true)}
      />

      <KPICards kpis={kpis} />

      <div className="main-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <TradingViewWidget />
          <OpenPositions trades={trades} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <CoinBreakdown coinData={coinData} />
        </div>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />

      <PineScriptExporter
        isOpen={isPineExporterOpen}
        onClose={() => setIsPineExporterOpen(false)}
      />
    </div>
  );
}
