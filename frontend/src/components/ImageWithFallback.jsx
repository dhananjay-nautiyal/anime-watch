import { useState } from 'react'
import { proxyImage } from '../api/imageProxy'

const FALLBACK_IMAGE = '/images/placeholder-anime.svg'

export default function ImageWithFallback({
  src,
  alt = '',
  className = '',
  containerClass = '',
  aspectRatio = 'aspect-[3/4]',
  lazy = true,
  onClick,
  children,
}) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  const imageSrc = error ? FALLBACK_IMAGE : (proxyImage(src) || FALLBACK_IMAGE)

  return (
    <div className={`relative overflow-hidden ${aspectRatio} ${containerClass}`}>
      {!loaded && !error && <div className="absolute inset-0 skeleton" />}
      <img
        src={imageSrc}
        alt={alt}
        className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'} ${className}`}
        loading={lazy ? 'lazy' : 'eager'}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        onClick={onClick}
      />
      {children}
    </div>
  )
}

export function BannerImage({ src, alt = '', className = '' }) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  const imageSrc = error ? FALLBACK_IMAGE : (proxyImage(src) || FALLBACK_IMAGE)

  return (
    <>
      {!loaded && !error && <div className={`absolute inset-0 skeleton ${className}`} />}
      <img
        src={imageSrc}
        alt={alt}
        className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-700 ${loaded ? 'opacity-100' : 'opacity-0'} ${className}`}
        loading="eager"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </>
  )
}
