export function getApiUrl(endpoint) {
  const base = import.meta.env.BASE_URL || '/ainstructor/'
  const cleanBase = base.endsWith('/') ? base : base + '/'
  return `${cleanBase}${endpoint}`
}
