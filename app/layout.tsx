import type React from "react"
import type { Metadata } from "next"
import { Inter, DM_Sans } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { GlassmorphismNav } from "@/components/header"
import { ScrollIndicator } from "@/components/scrollbar"

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
})

const dm = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500","700"],
  variable: "--font-heading"
})

export const metadata: Metadata = {
  title: "Blue World 9 – Soluções Educacionais",
  description:
    "Educando o futuro através da tecnologia, da robótica e da educação socioemocional. Inovação, propósito e sustentabilidade.",
  generator: "AutoNex",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  }
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} ${dm.variable} font-sans antialiased`}>
        <header><GlassmorphismNav /></header>
        <ScrollIndicator />
        <div className="blueworld-grid" />
        {children}
        <Analytics />
      </body>
    </html>
  )
}
