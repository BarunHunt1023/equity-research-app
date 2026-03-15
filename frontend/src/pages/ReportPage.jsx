import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAnalysis } from '../context/AnalysisContext'
import ReactMarkdown from 'react-markdown'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { primerStep1, primerStep2, primerStep3, primerStep4 } from '../api/client'

// ── Step metadata ─────────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Company Research',  desc: 'Analysing business model, moat, cost structure & risks…' },
  { id: 2, label: 'Industry Research', desc: 'Mapping value chain, competitive landscape & demand drivers…' },
  { id: 3, label: 'Synthesising Report', desc: 'Writing the 16-page Business & Industry Primer…' },
  { id: 4, label: 'Fact-Checking',     desc: 'Verifying numbers, flagging estimates, finalising…' },
]

// ── Progress bar component ────────────────────────────────────────────────────
function StepProgress({ currentStep, totalSteps }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-widest">
          Generating Business Primer
        </h2>
        <span className="text-xs text-gray-400 tabular-nums">
          Step {currentStep} of {totalSteps}
        </span>
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-2 mb-5">
        {STEPS.map((s) => {
          const done = currentStep > s.id
          const active = currentStep === s.id
          return (
            <div key={s.id} className="flex-1 flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                done   ? 'bg-emerald-500 text-white'
                : active ? 'bg-[#0a1628] text-white ring-4 ring-[#0a1628]/20'
                : 'bg-gray-100 text-gray-400'
              }`}>
                {done ? '✓' : s.id}
              </div>
              <span className={`text-[10px] text-center leading-tight font-medium ${
                done ? 'text-emerald-600' : active ? 'text-gray-800' : 'text-gray-400'
              }`}>
                {s.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Active step description */}
      {currentStep <= STEPS.length && (
        <div className="flex items-center gap-3 px-4 py-3 bg-[#0a1628]/5 rounded-lg">
          <div className="w-4 h-4 border-2 border-[#0a1628] border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <p className="text-sm text-gray-700">
            <span className="font-semibold">Step {currentStep}:</span>{' '}
            {STEPS[currentStep - 1]?.desc}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Markdown renderer ─────────────────────────────────────────────────────────
const MD_COMPONENTS = {
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold text-gray-900 mt-8 mb-3 pb-2 border-b border-gray-200 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-bold text-[#0a1628] mt-7 mb-2.5">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold text-gray-800 mt-5 mb-2">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-sm font-semibold text-gray-700 mt-4 mb-1.5 uppercase tracking-wide">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="text-gray-700 leading-relaxed mb-4 text-[15px]">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-6 mb-4 space-y-1.5 text-gray-700 text-[15px]">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-6 mb-4 space-y-1.5 text-gray-700 text-[15px]">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-[#0a1628] pl-4 italic text-gray-600 my-4 bg-gray-50 py-2 pr-4 rounded-r">
      {children}
    </blockquote>
  ),
  strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
  em: ({ children }) => <em className="italic text-gray-600">{children}</em>,
  hr: () => <hr className="border-gray-200 my-6" />,
  table: ({ children }) => (
    <div className="overflow-x-auto mb-6">
      <table className="w-full text-sm border-collapse border border-gray-200">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-[#0a1628] text-white">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-gray-100 even:bg-gray-50">{children}</tr>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide">{children}</th>
  ),
  td: ({ children }) => <td className="px-3 py-2 text-gray-700">{children}</td>,
  code: ({ inline, children }) =>
    inline
      ? <code className="bg-gray-100 rounded px-1 py-0.5 text-xs font-mono text-gray-800">{children}</code>
      : <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-xs font-mono mb-4"><code>{children}</code></pre>,
}

// ── PDF export ────────────────────────────────────────────────────────────────
async function exportPDF(reportRef, companyName) {
  const el = reportRef.current
  if (!el) return

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  })

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()   // 210mm
  const pageH = pdf.internal.pageSize.getHeight()  // 297mm
  const margin = 20
  const headerH = 14
  const footerH = 12
  const contentW = pageW - 2 * margin
  const contentH = pageH - margin - headerH - footerH

  // px → mm conversion (canvas is 2× scaled)
  const pxPerMm = (canvas.width / 2) / contentW
  const totalDocH = (canvas.height / 2) / pxPerMm  // total document height in mm
  const totalPages = Math.ceil(totalDocH / contentH)
  const today = new Date().toISOString().split('T')[0]
  const safeName = (companyName || 'Company').replace(/[^a-z0-9_\-]/gi, '_')
  const filename = `${safeName}_Business_Primer_${today}.pdf`

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) pdf.addPage()

    // ── Header ──
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    pdf.setTextColor(30, 30, 30)
    pdf.text(`${companyName} — Business & Industry Primer`, margin, margin - 5)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(100, 100, 100)
    pdf.text(today, pageW - margin, margin - 5, { align: 'right' })
    pdf.setDrawColor(200, 200, 200)
    pdf.line(margin, margin - 2, pageW - margin, margin - 2)

    // ── Content slice ──
    const sliceH = Math.min(contentH, totalDocH - page * contentH)
    const sliceCanvas = document.createElement('canvas')
    sliceCanvas.width = canvas.width
    sliceCanvas.height = Math.round(sliceH * pxPerMm * 2)
    const ctx = sliceCanvas.getContext('2d')
    ctx.drawImage(canvas, 0, -Math.round(page * contentH * pxPerMm * 2))

    const sliceImg = sliceCanvas.toDataURL('image/jpeg', 0.92)
    pdf.addImage(sliceImg, 'JPEG', margin, margin + headerH, contentW, sliceH)

    // ── Footer ──
    pdf.setDrawColor(200, 200, 200)
    pdf.line(margin, pageH - footerH, pageW - margin, pageH - footerH)
    pdf.setFontSize(7.5)
    pdf.setTextColor(130, 130, 130)
    pdf.text('For informational purposes only. Not financial advice.', margin, pageH - footerH + 5)
    pdf.text(`Page ${page + 1} of ${totalPages}`, pageW - margin, pageH - footerH + 5, { align: 'right' })
  }

  pdf.save(filename)
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ReportPage() {
  const { ticker, companyInfo } = useAnalysis()
  const navigate = useNavigate()
  const reportRef = useRef(null)

  const [step, setStep]           = useState(0)     // 0 = idle, 1-4 = running, 5 = done
  const [primer, setPrimer]       = useState(null)  // final markdown string
  const [error, setError]         = useState('')
  const [pdfLoading, setPdfLoading] = useState(false)
  const [retryCountdown, setRetryCountdown] = useState(0)
  const retryTimerRef = useRef(null)

  // Cleanup interval on unmount
  useEffect(() => () => clearInterval(retryTimerRef.current), [])

  const companyName = companyInfo?.name || ticker || 'Company'
  const today = new Date().toISOString().split('T')[0]

  const handleGenerate = useCallback(async () => {
    if (!ticker) return
    setError('')
    setPrimer(null)
    setStep(1)

    try {
      // Step 1 — Company Research
      const s1 = await primerStep1(ticker)
      setStep(2)

      // Step 2 — Industry Research
      const s2 = await primerStep2(ticker, s1.company_research)
      setStep(3)

      // Step 3 — Synthesis
      const s3 = await primerStep3(ticker, s1.company_research, s2.industry_research)
      setStep(4)

      // Step 4 — Fact-check
      const name = s1.company_name || companyName
      const s4 = await primerStep4(s3.primer_draft, name)
      setStep(5)

      setPrimer(s4.business_primer)
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Failed to generate primer')
      setStep(0)
      if (e.response?.status === 429) {
        const retryAfter = parseInt(e.response?.headers?.['retry-after'], 10)
        let secs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60
        setRetryCountdown(secs)
        retryTimerRef.current = setInterval(() => {
          secs -= 1
          setRetryCountdown(secs)
          if (secs <= 0) {
            clearInterval(retryTimerRef.current)
            setRetryCountdown(0)
            setError('')
            handleGenerate()
          }
        }, 1000)
      }
    }
  }, [ticker, companyName])

  const handleDownloadPDF = useCallback(async () => {
    setPdfLoading(true)
    try {
      await exportPDF(reportRef, companyName)
    } finally {
      setPdfLoading(false)
    }
  }, [companyName])

  if (!ticker) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-4">No company analysed yet.</p>
        <button onClick={() => navigate('/')} className="btn-primary">Go to Home</button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Business & Industry Primer</h1>
          <p className="text-gray-500 text-sm mt-0.5">{companyName} · {ticker}</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          {primer && (
            <button
              onClick={handleDownloadPDF}
              disabled={pdfLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pdfLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Exporting…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download PDF
                </>
              )}
            </button>
          )}
          <button
            onClick={handleGenerate}
            disabled={step > 0 && step < 5}
            className="btn-primary"
          >
            {step > 0 && step < 5 ? 'Generating…' : primer ? 'Regenerate' : 'Generate Primer'}
          </button>
        </div>
      </div>

      {/* ── Step progress ────────────────────────────────────────────── */}
      {step > 0 && step < 5 && (
        <StepProgress currentStep={step} totalSteps={STEPS.length} />
      )}

      {/* ── Error ───────────────────────────────────────────────────── */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* ── Rate-limit countdown ─────────────────────────────────────── */}
      {retryCountdown > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm flex items-center justify-between">
          <span>Rate limited — auto-retrying in <strong>{retryCountdown}s</strong>…</span>
          <button
            onClick={() => {
              clearInterval(retryTimerRef.current)
              setRetryCountdown(0)
              setError('')
              handleGenerate()
            }}
            className="text-amber-700 underline font-semibold ml-4"
          >
            Retry Now
          </button>
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────── */}
      {!primer && step === 0 && (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">📑</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Ready to Generate</h2>
          <p className="text-gray-400 text-sm max-w-lg mx-auto leading-relaxed">
            Click <strong>Generate Primer</strong> to run a 4-step AI research workflow: company
            deep-dive → industry analysis → 16-page synthesis → fact-check. Each step takes
            approximately 30–60 seconds.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {STEPS.map((s) => (
              <div key={s.id} className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center font-bold text-[10px]">
                  {s.id}
                </span>
                {s.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Report ───────────────────────────────────────────────────── */}
      {primer && step === 5 && (
        <div className="bg-white border border-gray-100 shadow-sm rounded-xl overflow-hidden">
          {/* Report header band */}
          <div className="bg-[#0a1628] px-8 py-5">
            <p className="text-white/50 text-xs uppercase tracking-widest font-semibold mb-1">
              Business &amp; Industry Primer
            </p>
            <h1 className="text-2xl font-bold text-white">{companyName}</h1>
            <p className="text-white/60 text-sm mt-1">
              {companyInfo?.sector && companyInfo.sector !== 'N/A' ? `${companyInfo.sector} · ` : ''}
              {companyInfo?.industry && companyInfo.industry !== 'N/A' ? `${companyInfo.industry} · ` : ''}
              Generated {today}
            </p>
          </div>

          {/* Markdown content */}
          <div ref={reportRef} className="px-8 py-8 max-w-4xl">
            <ReactMarkdown components={MD_COMPONENTS}>
              {primer}
            </ReactMarkdown>

            {/* Footer */}
            <div className="mt-10 pt-5 border-t border-gray-200 text-xs text-gray-400 flex justify-between flex-wrap gap-2">
              <span>Generated by Equity Research Pro — AI-Assisted Analysis</span>
              <span>For informational purposes only. Not financial advice.</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Navigation ───────────────────────────────────────────────── */}
      <div className="flex justify-start">
        <button onClick={() => navigate('/valuation')} className="btn-secondary">
          ← Valuation
        </button>
      </div>
    </div>
  )
}
