function timeAgo(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts * 1000
  const h = Math.floor(diff / 3600000)
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function sentimentBadge(title = '') {
  const lower = title.toLowerCase()
  const pos = ['surge', 'gain', 'beat', 'profit', 'record', 'growth', 'rise', 'up', 'strong', 'bullish', 'outperform']
  const neg = ['fall', 'drop', 'miss', 'loss', 'cut', 'weak', 'bearish', 'concern', 'warn', 'decline', 'sell']
  if (pos.some(w => lower.includes(w))) return { label: 'Positive', cls: 'bg-emerald-50 text-emerald-700' }
  if (neg.some(w => lower.includes(w))) return { label: 'Negative', cls: 'bg-red-50 text-red-600' }
  return { label: 'Neutral', cls: 'bg-gray-100 text-gray-500' }
}

export default function NewsFeed({ news = [], maxItems = 10 }) {
  const items = news.slice(0, maxItems)

  if (!items.length) {
    return <p className="text-gray-400 text-sm text-center py-6">No recent news available.</p>
  }

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const badge = sentimentBadge(item.title)
        return (
          <a
            key={i}
            href={item.link || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-white border border-gray-100 rounded-xl p-4 hover:border-blue-200
                       hover:shadow-sm transition-all group"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 leading-snug group-hover:text-blue-700
                               transition-colors line-clamp-2">
                  {item.title}
                </p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {item.publisher && (
                    <span className="text-xs text-gray-400 font-medium">{item.publisher}</span>
                  )}
                  {item.providerPublishTime && (
                    <span className="text-xs text-gray-300">{timeAgo(item.providerPublishTime)}</span>
                  )}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>
              </div>
              {item.thumbnail?.resolutions?.[0]?.url && (
                <img
                  src={item.thumbnail.resolutions[0].url}
                  alt=""
                  className="w-14 h-14 object-cover rounded-lg flex-shrink-0 bg-gray-100"
                  onError={e => { e.target.style.display = 'none' }}
                />
              )}
            </div>
          </a>
        )
      })}
    </div>
  )
}
