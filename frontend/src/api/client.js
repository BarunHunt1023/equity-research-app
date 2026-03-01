import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 120000, // 2 minutes for heavy computations
})

export async function analyzeCompany(ticker) {
  const { data } = await api.post('/analyze', { ticker })
  return data
}

export async function getForecast(ticker, assumptions = {}) {
  const { data } = await api.post('/forecast', { ticker, ...assumptions })
  return data
}

export async function runDCF(ticker, params = {}) {
  const { data } = await api.post('/dcf', { ticker, ...params })
  return data
}

export async function runRelativeValuation(ticker, peers = null) {
  const { data } = await api.post('/relative-valuation', { ticker, peers })
  return data
}

export async function generateReport(ticker, params = {}) {
  const { data } = await api.post('/report', { ticker, ...params })
  return data
}

export async function uploadPDF(file) {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function getPeers(ticker) {
  const { data } = await api.get(`/peers/${ticker}`)
  return data
}

export default api
