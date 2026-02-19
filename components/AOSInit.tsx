"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function shouldSkipAOS() {
  if (typeof window === "undefined") return true;
  const mqMobile = window.matchMedia("(max-width: 768px)");
  const mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const saveData = (navigator as any)?.connection?.saveData === true;
  return mqMobile.matches || mqReduce.matches || saveData;
}

export function AOSInit() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/portal/login" || pathname === "/portal/cadastro") return;
    if (shouldSkipAOS()) return;

    const run = async () => {
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
