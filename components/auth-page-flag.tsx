"use client"

import { useEffect } from "react"

export function AuthPageFlag() {
  useEffect(() => {
    const html = document.documentElement
    html.classList.add("auth-page")
    return () => {
      html.classList.remove("auth-page")
    }
  }, [])

  return null
}
