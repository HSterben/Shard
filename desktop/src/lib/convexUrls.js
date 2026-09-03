const DEFAULT_CONVEX_URL = 'https://strong-poodle-712.convex.cloud'

function siteFromCloud(cloudUrl) {
  return cloudUrl.replace(/\.convex\.cloud\/?$/, '.convex.site').replace(/\/$/, '')
}

export const convexUrl = (
  import.meta.env.VITE_CONVEX_URL || DEFAULT_CONVEX_URL
).replace(/\/$/, '')

export const convexSiteUrl = import.meta.env.VITE_CONVEX_SITE_URL
  ? String(import.meta.env.VITE_CONVEX_SITE_URL).replace(/\/$/, '')
  : siteFromCloud(convexUrl)
