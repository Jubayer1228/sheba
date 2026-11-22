export function uploadUrl(path?: string | null): string {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  if (path.startsWith('/')) return path
  return `/uploads/${path}`
}

export function pharmacyImage(url?: string): string {
  if (url) return uploadUrl(url)
  return 'data:image/svg+xml,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
      <rect fill="#F7F7F7" width="160" height="160"/>
      <text x="80" y="88" text-anchor="middle" font-size="40" fill="#D70F64">✚</text>
    </svg>`,
  )
}
