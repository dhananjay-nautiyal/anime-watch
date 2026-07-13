export function getAnimeImage(anime) {
  if (!anime) return '/placeholder-anime.jpg'

  if (anime.image) return anime.image
  if (anime.poster) return anime.poster
  if (anime.coverImage) return anime.coverImage
  if (anime.imageUrl) return anime.imageUrl
  if (anime.images?.jpg?.large_image_url) return anime.images.jpg.large_image_url
  if (anime.images?.jpg?.image_url) return anime.images.jpg.image_url
  if (anime.images?.webp?.large_image_url) return anime.images.webp.large_image_url
  if (anime.images?.webp?.image_url) return anime.images.webp.image_url

  return '/placeholder-anime.jpg'
}

export function isPlaceholderImage(url) {
  if (!url) return true
  return url.includes('placeholder') || url === '/placeholder-anime.jpg'
}
