const CONVEX_URL =
  import.meta.env.VITE_CONVEX_URL ?? 'https://strong-poodle-712.convex.cloud'

function siteUrlFromCloud(cloudUrl: string) {
  return cloudUrl.replace(/\.convex\.cloud\/?$/, '.convex.site').replace(/\/$/, '')
}

export const convexUrl = CONVEX_URL.replace(/\/$/, '')

export const convexSiteUrl = import.meta.env.VITE_CONVEX_SITE_URL
  ? String(import.meta.env.VITE_CONVEX_SITE_URL).replace(/\/$/, '')
  : siteUrlFromCloud(convexUrl)
