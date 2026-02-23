"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

let aosPromise: Promise<any> | null = null;

const loadAOS = () => {
  if (!aosPromise) {
    aosPromise = import("aos").then((mod) => mod.default ?? mod);
  }
  return aosPromise;
};

export function AOSInit() {
  const pathname = usePathname();

  useEffect(() => {
    // Avoid cost in pages that do not use AOS.
    if (pathname === "/portal/login" || pathname === "/portal/cadastro") return;

    let cancelled = false;

    const init = async () => {
      const AOS = await loadAOS();
      if (cancelled) return;
      AOS.init({
        duration: 800,
        once: true,
        easing: "ease-out",
        offset: 50,
        disable: () => window.innerWidth <= 768,
      });
      AOS.refreshHard();
    };

    const timer = window.setTimeout(init, 100);

    const onResize = async () => {
      const AOS = await loadAOS();
      if (cancelled) return;
      AOS.refreshHard();
    };

    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, [pathname]);

  return null;
}
