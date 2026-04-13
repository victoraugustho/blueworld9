"use client"

import { useEffect, useRef } from "react"

function redirectToLogin() {
  if (typeof window === "undefined") return
  if (window.location.pathname === "/") return
  window.location.replace("/")
}

function getRequestPath(input: RequestInfo | URL) {
  if (typeof input === "string") {
    if (input.startsWith("http://") || input.startsWith("https://")) {
      try {
        return new URL(input).pathname
      } catch {
        return input
      }
    }
    return input
  }

  if (input instanceof URL) {
    return input.pathname
  }

  if (typeof Request !== "undefined" && input instanceof Request) {
    try {
      return new URL(input.url).pathname
    } catch {
      return input.url
    }
  }

  return ""
}

function isProtectedApiPath(pathname: string) {
  return (
    pathname.startsWith("/api/portal/") ||
    pathname.startsWith("/api/admin/") ||
    pathname.startsWith("/api/ai/") ||
    pathname.startsWith("/api/files/")
  )
}

export function SessionExpiryGuard({ expiresAt }: { expiresAt: string }) {
  const redirectedRef = useRef(false)

  useEffect(() => {
    const expiresAtMs = new Date(expiresAt).getTime()
    if (!Number.isFinite(expiresAtMs)) return

    const redirectIfNeeded = () => {
      if (redirectedRef.current) return
      redirectedRef.current = true
      redirectToLogin()
    }

    const delay = expiresAtMs - Date.now()
    if (delay <= 0) {
      redirectIfNeeded()
      return
    }

    const timeoutId = window.setTimeout(redirectIfNeeded, delay + 250)
    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [expiresAt])

  useEffect(() => {
    const originalFetch = window.fetch.bind(window)

    const patchedFetch: typeof window.fetch = async (...args) => {
      const response = await originalFetch(...args)

      if (!redirectedRef.current && response.status === 401) {
        const pathname = getRequestPath(args[0])
        if (isProtectedApiPath(pathname)) {
          redirectedRef.current = true
          redirectToLogin()
        }
      }

      return response
    }

    window.fetch = patchedFetch
    return () => {
      window.fetch = originalFetch
    }
  }, [])

  return null
}
