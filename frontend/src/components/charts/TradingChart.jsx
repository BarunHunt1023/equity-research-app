import { useEffect, useRef, useState } from 'react'
import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts'
import {
  calcSMA, calcEMA, calcBollingerBands, calcRSI, calcMACD
} from '../../utils/indicators'

const TIMEFRAMES = [
  { label: '1W', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: '5Y', days: 1825 },
]

const CHART_TYPES = ['Candlestick', 'Line', 'Area']

const INDICATOR_DEFS = [
  { key: 'sma20',  label: 'SMA 20',  color: '#f59e0b' },
  { key: 'sma50',  label: 'SMA 50',  color: '#8b5cf6' },
  { key: 'sma200', label: 'SMA 200', color: '#ef4444' },
  { key: 'ema20',  label: 'EMA 20',  color: '#06b6d4' },
  { key: 'bb',     label: 'BB',      color: '#6366f1' },
  { key: 'rsi',    label: 'RSI',     color: '#10b981' },
  { key: 'macd',   label: 'MACD',    color: '#3b82f6' },
  { key: 'volume', label: 'Volume',  color: '#94a3b8' },
]

function filterByDays(data, days) {
  if (!data?.length) return []
  const cutoff = Date.now() - days * 86400000
  return data.filter(d => {
    const ts = typeof d.time === 'string'
      ? new Date(d.time).getTime()
      : d.time * 1000
    return ts >= cutoff
  })
}

function toChartData(rawPrices) {
  return rawPrices
    .filter(p => p.close != null)
    .map(p => ({
      time: p.date.slice(0, 10),
      open: p.open ?? p.close,
      high: p.high ?? p.close,
      low: p.low ?? p.close,
      close: p.close,
      volume: p.volume ?? 0,
    }))
    .sort((a, b) => (a.time > b.time ? 1 : -1))
}

export default function TradingChart({ priceHistory, impliedPrice, ticker, compact = false }) {
  const mainRef = useRef(null)
  const rsiRef = useRef(null)
  const macdRef = useRef(null)

  const chartRef = useRef(null)
  const rsiChartRef = useRef(null)
  const macdChartRef = useRef(null)

  const [chartType, setChartType] = useState('Candlestick')
  const [timeframe, setTimeframe] = useState('1Y')
  const [activeIndicators, setActiveIndicators] = useState({ volume: true })

  const allData = useRef([])

  const toggleIndicator = (key) => {
    setActiveIndicators(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Build & update charts whenever data/settings change
  useEffect(() => {
    if (!mainRef.current || !priceHistory?.length) return

    // Cleanup previous charts
    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null }
    if (rsiChartRef.current) { rsiChartRef.current.remove(); rsiChartRef.current = null }
    if (macdChartRef.current) { macdChartRef.current.remove(); macdChartRef.current = null }

    const tfDays = TIMEFRAMES.find(t => t.label === timeframe)?.days ?? 365
    const raw = toChartData(priceHistory)
    const data = filterByDays(raw, tfDays)
    allData.current = data
    if (!data.length) return

    const baseOpts = {
      layout: { background: { color: '#ffffff' }, textColor: '#374151' },
      grid: { vertLines: { color: '#f3f4f6' }, horzLines: { color: '#f3f4f6' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#e5e7eb' },
      timeScale: { borderColor: '#e5e7eb', timeVisible: true },
    }

    // ── Main chart ──────────────────────────────────────────────────
    const mainHeight = compact ? 260 : 420
    const chart = createChart(mainRef.current, { ...baseOpts, height: mainHeight })
    chartRef.current = chart

    let mainSeries
    if (chartType === 'Candlestick') {
      mainSeries = chart.addCandlestickSeries({
        upColor: '#26a69a', downColor: '#ef5350',
        borderUpColor: '#26a69a', borderDownColor: '#ef5350',
        wickUpColor: '#26a69a', wickDownColor: '#ef5350',
      })
      mainSeries.setData(data.map(d => ({
        time: d.time, open: d.open, high: d.high, low: d.low, close: d.close
      })))
    } else if (chartType === 'Line') {
      mainSeries = chart.addLineSeries({ color: '#3b82f6', lineWidth: 2 })
      mainSeries.setData(data.map(d => ({ time: d.time, value: d.close })))
    } else {
      mainSeries = chart.addAreaSeries({
        lineColor: '#3b82f6', topColor: 'rgba(59,130,246,0.2)', bottomColor: 'rgba(59,130,246,0.02)', lineWidth: 2,
      })
      mainSeries.setData(data.map(d => ({ time: d.time, value: d.close })))
    }

    // Implied price line
    if (impliedPrice > 0) {
      mainSeries.createPriceLine({
        price: impliedPrice,
        color: '#10b981',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `Intrinsic $${impliedPrice.toFixed(0)}`,
      })
    }

    // Overlaid MAs
    if (activeIndicators.sma20) {
      const s = chart.addLineSeries({ color: '#f59e0b', lineWidth: 1, title: 'SMA20' })
      s.setData(calcSMA(data, 20))
    }
    if (activeIndicators.sma50) {
      const s = chart.addLineSeries({ color: '#8b5cf6', lineWidth: 1, title: 'SMA50' })
      s.setData(calcSMA(data, 50))
    }
    if (activeIndicators.sma200) {
      const s = chart.addLineSeries({ color: '#ef4444', lineWidth: 1, title: 'SMA200' })
      s.setData(calcSMA(data, 200))
    }
    if (activeIndicators.ema20) {
      const s = chart.addLineSeries({ color: '#06b6d4', lineWidth: 1, title: 'EMA20' })
      s.setData(calcEMA(data, 20))
    }
    if (activeIndicators.bb) {
      const { upper, middle, lower } = calcBollingerBands(data)
      const uS = chart.addLineSeries({ color: '#6366f1', lineWidth: 1, lineStyle: LineStyle.Dashed })
      const mS = chart.addLineSeries({ color: '#6366f1', lineWidth: 1 })
      const lS = chart.addLineSeries({ color: '#6366f1', lineWidth: 1, lineStyle: LineStyle.Dashed })
      uS.setData(upper); mS.setData(middle); lS.setData(lower)
    }

    // Volume sub-pane
    if (activeIndicators.volume) {
      const volSeries = chart.addHistogramSeries({
        color: '#93c5fd',
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      })
      chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })
      volSeries.setData(data.map(d => ({
        time: d.time,
        value: d.volume,
        color: d.close >= d.open ? 'rgba(38,166,154,0.4)' : 'rgba(239,83,80,0.4)',
      })))
    }

    chart.timeScale().fitContent()

    // ── RSI sub-chart ────────────────────────────────────────────────
    if (activeIndicators.rsi && rsiRef.current) {
      const rsiChart = createChart(rsiRef.current, {
        ...baseOpts, height: 120,
        rightPriceScale: { ...baseOpts.rightPriceScale, scaleMargins: { top: 0.1, bottom: 0.1 } },
      })
      rsiChartRef.current = rsiChart
      const rsiLine = rsiChart.addLineSeries({ color: '#10b981', lineWidth: 1.5 })
      rsiLine.setData(calcRSI(data, 14))
      rsiLine.createPriceLine({ price: 70, color: '#ef4444', lineWidth: 1, lineStyle: LineStyle.Dashed })
      rsiLine.createPriceLine({ price: 30, color: '#10b981', lineWidth: 1, lineStyle: LineStyle.Dashed })
      rsiChart.timeScale().fitContent()
    }

    // ── MACD sub-chart ───────────────────────────────────────────────
    if (activeIndicators.macd && macdRef.current) {
      const macdChart = createChart(macdRef.current, { ...baseOpts, height: 120 })
      macdChartRef.current = macdChart
      const { macd, signal, histogram } = calcMACD(data)
      const histSeries = macdChart.addHistogramSeries({ priceScaleId: 'right' })
      histSeries.setData(histogram)
      const macdLine = macdChart.addLineSeries({ color: '#3b82f6', lineWidth: 1.5 })
      macdLine.setData(macd)
      const signalLine = macdChart.addLineSeries({ color: '#f97316', lineWidth: 1.5 })
      signalLine.setData(signal)
      macdChart.timeScale().fitContent()
    }

    return () => {
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null }
      if (rsiChartRef.current) { rsiChartRef.current.remove(); rsiChartRef.current = null }
      if (macdChartRef.current) { macdChartRef.current.remove(); macdChartRef.current = null }
    }
  }, [priceHistory, chartType, timeframe, activeIndicators, impliedPrice, compact])

  if (!priceHistory?.length) {
    return <p className="text-gray-400 text-sm py-8 text-center">No price history available.</p>
  }

  return (
    <div className="w-full">
      {/* Controls */}
      {!compact && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {/* Timeframe */}
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf.label}
                onClick={() => setTimeframe(tf.label)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  timeframe === tf.label
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Chart type */}
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
            {CHART_TYPES.map(ct => (
              <button
                key={ct}
                onClick={() => setChartType(ct)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  chartType === ct
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {ct}
              </button>
            ))}
          </div>

          {/* Indicators */}
          <div className="flex flex-wrap items-center gap-1 ml-1">
            {INDICATOR_DEFS.map(ind => (
              <button
                key={ind.key}
                onClick={() => toggleIndicator(ind.key)}
                style={activeIndicators[ind.key] ? { borderColor: ind.color, color: ind.color } : {}}
                className={`px-2 py-0.5 text-xs font-semibold rounded border transition-colors ${
                  activeIndicators[ind.key]
                    ? 'bg-opacity-10'
                    : 'border-gray-200 text-gray-400 hover:text-gray-600'
                }`}
              >
                {ind.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chart panes */}
      <div ref={mainRef} className="w-full rounded-lg overflow-hidden border border-gray-100" />
      {activeIndicators.rsi && (
        <div className="mt-1">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1 mb-0.5">RSI (14)</div>
          <div ref={rsiRef} className="w-full rounded-lg overflow-hidden border border-gray-100" />
        </div>
      )}
      {activeIndicators.macd && (
        <div className="mt-1">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1 mb-0.5">MACD (12,26,9)</div>
          <div ref={macdRef} className="w-full rounded-lg overflow-hidden border border-gray-100" />
        </div>
      )}
    </div>
  )
}
