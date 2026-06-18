export default function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null

  const getPages = () => {
    const pages = []
    const delta = 2
    const start = Math.max(0, page - delta)
    const end = Math.min(totalPages - 1, page + delta)

    if (start > 0) {
      pages.push(0)
      if (start > 1) pages.push('...')
    }

    for (let i = start; i <= end; i++) pages.push(i)

    if (end < totalPages - 1) {
      if (end < totalPages - 2) pages.push('...')
      pages.push(totalPages - 1)
    }

    return pages
  }

  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 0}
        className="px-3 py-1.5 rounded-lg text-sm text-muted hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        aria-label="Previous page"
      >
        Prev
      </button>
      {getPages().map((p, i) => (
        p === '...' ? (
          <span key={`dots-${i}`} className="text-muted px-1 text-sm">...</span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-all ${
              p === page
                ? 'bg-primary text-white shadow-glow'
                : 'text-muted hover:text-white hover:bg-white/5'
            }`}
          >
            {p + 1}
          </button>
        )
      ))}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages - 1}
        className="px-3 py-1.5 rounded-lg text-sm text-muted hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        aria-label="Next page"
      >
        Next
      </button>
    </div>
  )
}
