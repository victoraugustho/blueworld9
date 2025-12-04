import type React from "react";
import type { Metadata } from "next";
import { Inter, DM_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { GlassmorphismNav } from "@/components/header";
import { ScrollIndicator } from "@/components/scrollbar";
import { AOSInit } from "@/components/AOSInit";
import { headers } from "next/headers";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const dm = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-heading",
});

export const metadata: Metadata = {
  title: "Blue World 9 – Soluções Educacionais",
  description:
    "Educando o futuro através da tecnologia, robótica e educação socioemocional. Inovação, propósito e sustentabilidade.",
  generator: "AutoNex",
  metadataBase: new URL("https://bw9global.com"),
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    title: "Blue World 9 – Soluções Educacionais",
    description:
      "Educando o futuro através da tecnologia, robótica e educação socioemocional. Inovação, propósito e sustentabilidade.",
    url: "https://bw9global.com",
    siteName: "Blue World 9",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Blue World 9",
      },
    ],
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blue World 9 – Soluções Educacionais",
    description:
      "Uma nova era na educação: tecnologia, robótica e desenvolvimento humano.",
    images: ["/og-image.png"],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {


  const hdr = await headers();

  let fullUrl = hdr.get("x-middleware-request-url");

  if (!fullUrl) {
    fullUrl = hdr.get("referer") || "";
  }
  let path = "";
  try {
    if (fullUrl) {
      path = new URL(fullUrl).pathname;
    }
  } catch {
    path = "";
  }

  const isPortal = path.startsWith("/portal");

  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} ${dm.variable} font-sans antialiased`}>
        <AOSInit />

        {/* Navegação e efeitos SOMENTE para o site público */}
        {!isPortal && (
          <>
            <header>
              <GlassmorphismNav />
            </header>
            <ScrollIndicator />
            <div className="blueworld-grid" />
          </>
        )}

        {children}

        <Analytics />
      </body>
    </html>
  );
}
