"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function AOSInit() {
  const pathname = usePathname();

  useEffect(() => {
    // Evita custo em páginas sem AOS
    if (pathname === "/portal/login" || pathname === "/portal/cadastro") return;

    const run = async () => {
      // CSS + lib carregados fora do caminho crítico
      await import("aos/dist/aos.css");
      const AOS = (await import("aos")).default;
      AOS.init({
        duration: 800,
        once: true,
        easing: "ease-out",
        offset: 50,
      });
    };

    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(run, { timeout: 1500 });
    } else {
      setTimeout(run, 500);
    }
  }, [pathname]);

  return null;
}
