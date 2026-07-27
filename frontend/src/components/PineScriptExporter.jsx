import React, { useState } from 'react';
import { X, Copy, Check, Code, ExternalLink } from 'lucide-react';

export default function PineScriptExporter({ isOpen, onClose }) {
  if (!isOpen) return null;

  const [copied, setCopied] = useState(false);

  const pineCode = `//@version=6
strategy("BingX Bot TP - REAL TRADING [CLR]", 
         overlay=true, 
         initial_capital=100, 
         default_qty_type=strategy.percent_of_equity, 
         default_qty_value=5, 
         commission_type=strategy.commission.percent, 
         commission_value=0.075,
         process_orders_on_close=true, 
         slippage=3)
// ==========================================
// CONFIGURACIÓN DE PARÁMETROS
// ==========================================
var string PASSPHRASE = input.string("clr_bingx_secret_passphrase_2026", title="Passphrase Webhook / BingX")
// Interruptor de Filtros de Rango (¡La clave de la rentabilidad!)
useFilters = input.bool(true, title="Activar Filtros Avanzados (ADX > 20 + Chop < 55)")
// Parámetros de Entrada Manual (Para monedas fuera de las 20 principales)
inputAtrPeriod = input.int(10, title="ATR Periodo (Manual)")
inputFactor    = input.float(3.0, title="Factor ATR (Manual)")
inputSlMult    = input.float(2.5, title="Stop Loss Multiplicador ATR (Manual)")
inputTpRatio   = input.float(2.0, title="Ratio Take Profit (Manual)")
// Detección Dinámica de Monedas 100% Infalible usando Tickers
isBTC = str.contains(syminfo.ticker, "BTC")
isETH = str.contains(syminfo.ticker, "ETH")
isSOL = str.contains(syminfo.ticker, "SOL")
isADA = str.contains(syminfo.ticker, "ADA")
isLTC = str.contains(syminfo.ticker, "LTC")
isLINK = str.contains(syminfo.ticker, "LINK")
isDOT = str.contains(syminfo.ticker, "DOT")
isAVAX = str.contains(syminfo.ticker, "AVAX")
isXRP = str.contains(syminfo.ticker, "XRP")
isUNI = str.contains(syminfo.ticker, "UNI")
isFTM = str.contains(syminfo.ticker, "FTM")
isNEAR = str.contains(syminfo.ticker, "NEAR")
isDOGE = str.contains(syminfo.ticker, "DOGE")
isSHIB = str.contains(syminfo.ticker, "SHIB")
isSUI = str.contains(syminfo.ticker, "SUI")
isAPT = str.contains(syminfo.ticker, "APT")
isARB = str.contains(syminfo.ticker, "ARB")
isOP = str.contains(syminfo.ticker, "OP")
isPEPE = str.contains(syminfo.ticker, "PEPE")
isORDI = str.contains(syminfo.ticker, "ORDI")
// Asignación de parámetros tipo simple
atrPeriod = isBTC or isETH ? 12 : (isSOL or isADA or isLTC or isLINK or isDOT or isAVAX or isXRP or isUNI or isFTM or isNEAR ? 10 : (isDOGE or isSHIB or isSUI or isAPT or isARB or isOP or isPEPE or isORDI ? 10 : inputAtrPeriod))
factor = isBTC or isETH ? 4.0 : (isSOL or isADA or isLTC or isLINK or isDOT or isAVAX or isXRP or isUNI or isFTM or isNEAR ? 4.0 : (isDOGE or isSHIB or isSUI or isAPT or isARB or isOP or isPEPE or isORDI ? 4.5 : inputFactor))
slMultiplier = isBTC or isETH ? 2.5 : (isSOL or isADA or isLTC or isLINK or isDOT or isAVAX or isXRP or isUNI or isFTM or isNEAR ? 2.5 : (isDOGE or isSHIB or isSUI or isAPT or isARB or isOP or isPEPE or isORDI ? 3.0 : inputSlMult))
tpRatio = isBTC or isETH ? 2.0 : (isSOL or isADA or isLTC or isLINK or isDOT or isAVAX or isXRP or isUNI or isFTM or isNEAR ? 1.8 : (isDOGE or isSHIB or isSUI or isAPT or isARB or isOP or isPEPE or isORDI ? 1.5 : inputTpRatio))
// Ejecutar Supertrend con parámetros automáticos constantes
[supertrend, direction] = ta.supertrend(factor, atrPeriod)
// 1. Filtro de Tendencia Mayor (EMA 200)
ema200 = ta.ema(close, 200)
plot(ema200, color=color.blue, title="Filtro de Tendencia (EMA 200)", linewidth=2)
// 2. Filtro Choppiness Index
chopPeriod  = 14
highestHigh = ta.highest(high, chopPeriod)
lowestLow   = ta.lowest(low, chopPeriod)
chopVal     = 100 * math.log10(math.sum(ta.atr(1), chopPeriod) / (highestHigh - lowestLow)) / math.log10(chopPeriod)
// 3. Filtro de Fuerza ADX
[diplus, diminus, adx] = ta.dmi(14, 14)
// Validación de filtros según el interruptor
filterCondition = not useFilters or (chopVal < 55 and adx > 20)
// CONDICIONES DE ENTRADA (CON FILTROS AUTOMÁTICOS)
longCondition  = barstate.isconfirmed and ta.change(direction) < 0 and close > ema200 and filterCondition
shortCondition = barstate.isconfirmed and ta.change(direction) > 0 and close < ema200 and filterCondition
// Gestión de Riesgo (ATR Dinámico y Trailing SL)
atr = ta.atr(14)
var float tradeSL    = na
var float tradeTP    = na
var float entryPrice = na
var float maxPrice   = na
var float minPrice   = na
// ENTRADA LONG REAL
if (longCondition and strategy.position_size == 0)
    entryPrice := close
    maxPrice   := close
    tradeSL    := close - (atr * slMultiplier)
    tradeTP    := close + ((close - tradeSL) * tpRatio)
    strategy.entry("Long", strategy.long)

// ENTRADA SHORT REAL
if (shortCondition and strategy.position_size == 0)
    entryPrice := close
    minPrice   := close
    tradeSL    := close + (atr * slMultiplier)
    tradeTP    := close - ((tradeSL - close) * tpRatio)
    strategy.entry("Short", strategy.short)

// GESTIÓN DE POSICIÓN LONG
if (strategy.position_size > 0)
    maxPrice := math.max(close, nz(maxPrice, entryPrice))
    commissionOffset = entryPrice * 0.0015
    
    // Trailing Stop dinámico usando slMultiplier para dar respiro al trade
    dynamicSL = maxPrice - (atr * slMultiplier)
    tradeSL   := math.max(tradeSL, dynamicSL)
    
    // Breakeven al avanzar 1.0 * ATR
    if (maxPrice - entryPrice >= atr)
        tradeSL := math.max(tradeSL, entryPrice + commissionOffset)
        
    strategy.exit("Exit Long", "Long", stop=tradeSL, limit=tradeTP)
else
    maxPrice := na

// GESTIÓN DE POSICIÓN SHORT
if (strategy.position_size < 0)
    minPrice := math.min(close, nz(minPrice, entryPrice))
    commissionOffset = entryPrice * 0.0015
    
    // Trailing Stop dinámico usando slMultiplier para dar respiro al trade
    dynamicSL = minPrice + (atr * slMultiplier)
    tradeSL   := math.min(tradeSL, dynamicSL)
    
    if (entryPrice - minPrice >= atr)
        tradeSL := math.min(tradeSL, entryPrice - commissionOffset)
        
    strategy.exit("Exit Short", "Short", stop=tradeSL, limit=tradeTP)
else
    minPrice := na

// VISUALIZACIÓN
plot(supertrend, color=direction < 0 ? color.green : color.red, title="Supertrend", linewidth=2)
`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(pineCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(5, 10, 20, 0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '720px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Code size={22} color="#00e699" />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Estrategia Pine Script v5 para TradingView</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 12 }}>
          Copia este código y pégalo en el editor <strong>Pine Editor</strong> de TradingView. Luego crea una alerta asignándole la URL Webhook de tu bot.
        </p>

        <div style={{ position: 'relative' }}>
          <pre className="mono" style={{
            background: '#090d16',
            padding: '16px',
            borderRadius: '8px',
            fontSize: '0.8rem',
            color: '#a7f3d0',
            maxHeight: '320px',
            overflowY: 'auto',
            border: '1px solid var(--border-glass)'
          }}>
            {pineCode}
          </pre>

          <button
            onClick={copyToClipboard}
            className="btn-primary"
            style={{ position: 'absolute', top: 12, right: 12, fontSize: '0.75rem', padding: '6px 12px' }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? '¡Copiado!' : 'Copiar Código'}
          </button>
        </div>

        <div style={{ marginTop: 16, padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
          <span style={{ fontSize: '0.8rem', color: '#93c5fd', fontWeight: 600 }}>
            📌 Formato del mensaje de la alerta en TradingView:
          </span>
          <pre className="mono" style={{ fontSize: '0.75rem', marginTop: 6, color: '#f3f4f6' }}>
{`{
  "passphrase": "clr_bingx_secret_passphrase_2026",
  "action": "{{strategy.market_position}}",
  "symbol": "{{ticker}}",
  "price": "{{strategy.order.price}}"
}`}
          </pre>
        </div>
      </div>
    </div>
  );
}
