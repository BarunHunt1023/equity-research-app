import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 120000, // 2 minutes for heavy computations
})

// Longer timeout for Claude API calls (each step can take 60-90s)
const reportApi = axios.create({
  baseURL: '/api',
  timeout: 240000, // 4 minutes per step
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

export async function primerStep1(ticker, company_name = null) {
  const { data } = await reportApi.post('/report/primer/step1', { ticker, company_name })
  return data
}

export async function primerStep2(ticker, company_research, company_name = null) {
  const { data } = await reportApi.post('/report/primer/step2', { ticker, company_research, company_name })
  return data
}

export async function primerStep3(ticker, company_research, industry_research, company_name = null) {
  const { data } = await reportApi.post('/report/primer/step3', { ticker, company_research, industry_research, company_name })
  return data
}

export async function primerStep4(primer_draft, company_name) {
  const { data } = await reportApi.post('/report/primer/step4', { primer_draft, company_name })
  return data
}

export async function uploadFinancials(file, ticker = '') {
  const formData = new FormData()
  formData.append('file', file)
  if (ticker) {
    formData.append('ticker', ticker)
  }
  const { data } = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

// Keep old name as alias for backward compat
export const uploadPDF = uploadFinancials

export async function getPeers(ticker) {
  const { data } = await api.get(`/peers/${ticker}`)
  return data
}

export default api
