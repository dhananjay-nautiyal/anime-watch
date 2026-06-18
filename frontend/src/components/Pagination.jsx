export default function Pagination({ page, totalPages, onPageChange }) {
  if (!totalPages || totalPages <= 1) return null

  const pages = []
  const maxVisible = 5
  let start = Math.max(0, page - Math.floor(maxVisible / 2))
  let end = Math.min(totalPages, start + maxVisible)
  if (end - start < maxVisible) start = Math.max(0, end - maxVisible)

  for (let i = start; i < end; i++) {
    pages.push(i)
  }

  return (
    <div className="flex justify-center items-center gap-2 mt-8">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 0}
        className="px-3 py-1.5 rounded bg-card text-dimWhite hover:bg-cardHover disabled:opacity-30 disabled:cursor-not-allowed transition"
      >
        Prev
      </button>
      {start > 0 && (
        <>
          <button onClick={() => onPageChange(0)} className="px-3 py-1.5 rounded bg-card text-dimWhite hover:bg-cardHover transition">1</button>
          {start > 1 && <span className="text-dimWhite">...</span>}
        </>
      )}
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          className={`px-3 py-1.5 rounded transition ${
            p === page ? 'bg-secondary text-white' : 'bg-card text-dimWhite hover:bg-cardHover'
          }`}
        >
          {p + 1}
        </button>
      ))}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="text-dimWhite">...</span>}
          <button onClick={() => onPageChange(totalPages - 1)} className="px-3 py-1.5 rounded bg-card text-dimWhite hover:bg-cardHover transition">{totalPages}</button>
        </>
      )}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages - 1}
        className="px-3 py-1.5 rounded bg-card text-dimWhite hover:bg-cardHover disabled:opacity-30 disabled:cursor-not-allowed transition"
      >
        Next
      </button>
    </div>
  )
}
