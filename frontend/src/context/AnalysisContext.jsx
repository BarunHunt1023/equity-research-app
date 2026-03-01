import { createContext, useContext, useReducer } from 'react'

const AnalysisContext = createContext(null)
const AnalysisDispatchContext = createContext(null)

const initialState = {
  ticker: '',
  loading: false,
  error: null,
  companyInfo: null,
  financials: null,
  historicalPrices: [],
  ratios: null,
  historicalMetrics: [],
  forecast: null,
  dcf: null,
  relativeValuation: null,
  report: null,
  uploadedData: null,
}

function analysisReducer(state, action) {
  switch (action.type) {
    case 'SET_TICKER':
      return { ...state, ticker: action.payload }
    case 'SET_LOADING':
      return { ...state, loading: action.payload, error: null }
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false }
    case 'SET_ANALYSIS':
      return {
        ...state,
        loading: false,
        companyInfo: action.payload.company_info,
        financials: action.payload.financials,
        historicalPrices: action.payload.historical_prices || [],
        ratios: action.payload.ratios,
        historicalMetrics: action.payload.historical_metrics || [],
      }
    case 'SET_FORECAST':
      return { ...state, forecast: action.payload, loading: false }
    case 'SET_DCF':
      return { ...state, dcf: action.payload, loading: false }
    case 'SET_RELATIVE_VALUATION':
      return { ...state, relativeValuation: action.payload, loading: false }
    case 'SET_REPORT':
      return { ...state, report: action.payload, loading: false }
    case 'SET_UPLOADED_DATA':
      return { ...state, uploadedData: action.payload, loading: false }
    case 'RESET':
      return { ...initialState }
    default:
      return state
  }
}

export function AnalysisProvider({ children }) {
  const [state, dispatch] = useReducer(analysisReducer, initialState)
  return (
    <AnalysisContext.Provider value={state}>
      <AnalysisDispatchContext.Provider value={dispatch}>
        {children}
      </AnalysisDispatchContext.Provider>
    </AnalysisContext.Provider>
  )
}

export function useAnalysis() {
  return useContext(AnalysisContext)
}

export function useAnalysisDispatch() {
  return useContext(AnalysisDispatchContext)
}
