"use client";

import { useState, useEffect } from "react";

export const safeAreaTop    = "env(safe-area-inset-top)";
export const safeAreaBottom = "env(safe-area-inset-bottom)";
export const bottomNavHeight = "4rem"; // BottomNav is h-16

/**
 * Returns the actual visible viewport height, updated on mobile browser chrome
 * resize (keyboard open/close, address-bar shrink, etc.).
 * Uses 100dvh via CSS where possible, with a JS fallback.
 */
export function useViewportHeight(): number {
  const [height, setHeight] = useState(
    () => (typeof window !== "undefined" ? window.innerHeight : 0),
  );

  useEffect(() => {
    const vv = window.visualViewport;

    function update() {
      setHeight(vv ? vv.height : window.innerHeight);
    }

    update();
    if (vv) {
      vv.addEventListener("resize", update);
      return () => vv.removeEventListener("resize", update);
    } else {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }
  }, []);

  return height;
}
