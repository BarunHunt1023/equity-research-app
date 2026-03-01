import { useState } from 'react'

export default function PeerSelector({ peers, onChange }) {
  const [input, setInput] = useState('')

  const add = () => {
    const t = input.toUpperCase().trim()
    if (t && !peers.includes(t)) {
      onChange([...peers, t])
    }
    setInput('')
  }

  const remove = (ticker) => {
    onChange(peers.filter((p) => p !== ticker))
  }

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Peer Companies</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {peers.map((p) => (
          <span
            key={p}
            className="flex items-center gap-1.5 bg-primary-100 text-primary-700 px-3 py-1 rounded-full text-sm font-medium"
          >
            {p}
            <button
              onClick={() => remove(p)}
              className="hover:text-primary-900 transition-colors leading-none"
              aria-label={`Remove ${p}`}
            >
              ×
            </button>
          </span>
        ))}
        {peers.length === 0 && (
          <span className="text-sm text-gray-400">No peers selected</span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Add ticker (e.g. MSFT)"
          className="input-field text-sm py-1.5 max-w-[160px]"
        />
        <button onClick={add} className="btn-secondary text-sm py-1.5 px-4">
          Add
        </button>
      </div>
    </div>
  )
}
