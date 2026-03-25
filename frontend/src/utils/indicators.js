/**
 * Technical indicator calculations for trading charts.
 * All functions accept an array of {time, open, high, low, close, volume} objects
 * and return arrays compatible with lightweight-charts LineSeries / HistogramSeries.
 */

/** Simple Moving Average */
export function calcSMA(data, period) {
  const result = []
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1)
    const avg = slice.reduce((s, d) => s + d.close, 0) / period
    result.push({ time: data[i].time, value: avg })
  }
  return result
}

/** Exponential Moving Average */
export function calcEMA(data, period) {
  if (data.length < period) return []
  const k = 2 / (period + 1)
  const result = []
  // Seed with SMA of first `period` bars
  let ema = data.slice(0, period).reduce((s, d) => s + d.close, 0) / period
  result.push({ time: data[period - 1].time, value: ema })
  for (let i = period; i < data.length; i++) {
    ema = data[i].close * k + ema * (1 - k)
    result.push({ time: data[i].time, value: ema })
  }
  return result
}

/** Bollinger Bands — returns { upper, middle, lower } each as [{time, value}] */
export function calcBollingerBands(data, period = 20, stdDevMult = 2) {
  const upper = [], middle = [], lower = []
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1)
    const avg = slice.reduce((s, d) => s + d.close, 0) / period
    const variance = slice.reduce((s, d) => s + (d.close - avg) ** 2, 0) / period
    const sd = Math.sqrt(variance)
    const t = data[i].time
    middle.push({ time: t, value: avg })
    upper.push({ time: t, value: avg + stdDevMult * sd })
    lower.push({ time: t, value: avg - stdDevMult * sd })
  }
  return { upper, middle, lower }
}

/** RSI (Relative Strength Index) */
export function calcRSI(data, period = 14) {
  if (data.length < period + 1) return []
  const result = []
  let gains = 0, losses = 0
  for (let i = 1; i <= period; i++) {
    const diff = data[i].close - data[i - 1].close
    if (diff > 0) gains += diff
    else losses -= diff
  }
  let avgGain = gains / period
  let avgLoss = losses / period
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
  result.push({ time: data[period].time, value: 100 - 100 / (1 + rs) })

  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close
    const gain = diff > 0 ? diff : 0
    const loss = diff < 0 ? -diff : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
    result.push({ time: data[i].time, value: rsi })
  }
  return result
}

/** MACD — returns { macd, signal, histogram } each as [{time, value}] */
export function calcMACD(data, fast = 12, slow = 26, signalPeriod = 9) {
  const emaFast = calcEMA(data, fast)
  const emaSlow = calcEMA(data, slow)

  // Align by time
  const slowTimes = new Map(emaSlow.map(d => [d.time, d.value]))
  const fastTimes = new Map(emaFast.map(d => [d.time, d.value]))
  const macdLine = []
  for (const [t, sv] of slowTimes) {
    if (fastTimes.has(t)) {
      macdLine.push({ time: t, value: fastTimes.get(t) - sv })
    }
  }
  macdLine.sort((a, b) => (a.time > b.time ? 1 : -1))

  // Signal = EMA of macd
  if (macdLine.length < signalPeriod) return { macd: macdLine, signal: [], histogram: [] }
  const k = 2 / (signalPeriod + 1)
  let sig = macdLine.slice(0, signalPeriod).reduce((s, d) => s + d.value, 0) / signalPeriod
  const signal = [{ time: macdLine[signalPeriod - 1].time, value: sig }]
  for (let i = signalPeriod; i < macdLine.length; i++) {
    sig = macdLine[i].value * k + sig * (1 - k)
    signal.push({ time: macdLine[i].time, value: sig })
  }

  // Histogram
  const sigMap = new Map(signal.map(d => [d.time, d.value]))
  const histogram = macdLine
    .filter(d => sigMap.has(d.time))
    .map(d => ({
      time: d.time,
      value: d.value - sigMap.get(d.time),
      color: d.value - sigMap.get(d.time) >= 0 ? '#26a69a' : '#ef5350',
    }))

  return { macd: macdLine, signal, histogram }
}
