import type { NextRequest } from 'next/server'

function httpOrigin(value: string, allowPath = false) {
  try {
    const url = new URL(value)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null
    if (!allowPath && (url.pathname !== '/' || url.search || url.hash)) return null
    return url.origin
  } catch {
    return null
  }
}

export function getRequestOriginPolicy(req: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  const source = siteUrl ? 'NEXT_PUBLIC_SITE_URL' : 'request'
  const serverOrigin = httpOrigin(req.nextUrl.origin)
  // Never derive a trusted origin from client-supplied forwarded headers.
  const expectedOrigin = siteUrl ? httpOrigin(siteUrl, true) : serverOrigin
  const header = req.headers.get('origin')
  const requestOrigin = header === null ? null : httpOrigin(header)
  const fetchSite = req.headers.get('sec-fetch-site')
  const crossSite = fetchSite === 'cross-site' || (header === null && fetchSite === 'same-site')

  return {
    valid: !!expectedOrigin && !crossSite && (header === null || (!!requestOrigin && requestOrigin === expectedOrigin)),
    configurationValid: !!expectedOrigin,
    originPresent: header !== null,
    requestOrigin,
    serverOrigin,
    expectedOrigin,
    source,
  }
}
