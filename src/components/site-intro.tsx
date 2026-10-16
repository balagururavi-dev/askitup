"use client";

import { useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "askitup-intro-seen";

/**
 * Session-once intro class for decorative motion only.
 * Content stays painted (no opacity:0 on LCP). Animation is CSS-driven and
 * skipped when reduced-motion is set or the session already saw it.
 */
export function SiteIntro({ children }: { children: ReactNode }) {
  const [play, setPlay] = useState(false);

  useEffect(() => {
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
      }
      if (sessionStorage.getItem(STORAGE_KEY) === "1") {
        return;
      }
      sessionStorage.setItem(STORAGE_KEY, "1");
      // Defer one frame so first paint (LCP) is not blocked by the class flip.
      const id = window.requestAnimationFrame(() => setPlay(true));
      return () => window.cancelAnimationFrame(id);
    } catch {
      // Private mode / blocked storage — skip intro quietly.
    }
  }, []);

  return (
    <div className={play ? "site-intro site-intro--play" : "site-intro"}>
      {children}
    </div>
  );
}
