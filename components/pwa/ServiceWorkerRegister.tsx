"use client";

import { useEffect } from "react";

/**
 * Regisztrálja a service workert (public/sw.js), hogy az app telepíthető és
 * alap offline-cache-eléssel használható legyen. Csak production build-ben
 * fut — fejlesztés közben (`next dev`) a cache összezavarná a Turbopack
 * hot-reloadját, ezért ott szándékosan kihagyjuk.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Néma hibakezelés: service worker nélkül is teljes értékű az app,
      // csak nem lesz telepíthető/offline-képes.
    });
  }, []);

  return null;
}
