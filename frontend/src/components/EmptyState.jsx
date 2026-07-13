import { Link } from 'react-router-dom'

export default function EmptyState({
  title = 'Nothing here yet',
  message,
  actionLabel,
  actionLink,
  icon = 'default',
}) {
  return (
    <div className="text-center py-16 px-6">
      <div className="w-16 h-16 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-5">
        {icon === 'bookmark' ? (
          <svg className="w-7 h-7 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        ) : icon === 'heart' ? (
          <svg className="w-7 h-7 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        ) : icon === 'search' ? (
          <svg className="w-7 h-7 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        ) : (
          <svg className="w-7 h-7 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        )}
      </div>
      <h3 className="text-white text-base font-bold mb-1.5">{title}</h3>
      {message && <p className="text-[#9CA3AF] text-sm mb-6 max-w-xs mx-auto">{message}</p>}
      {actionLabel && actionLink && (
        <Link
          to={actionLink}
          className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-all hover:shadow-glow active:scale-95"
        >
          {actionLabel}
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </Link>
      )}
    </div>
  )
}
