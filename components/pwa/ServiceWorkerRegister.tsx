"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Regisztrálja a service workert (public/sw.js), hogy az app telepíthető és
 * alap offline-cache-eléssel használható legyen. Csak production build-ben
 * fut — fejlesztés közben (`next dev`) a cache összezavarná a Turbopack
 * hot-reloadját, ezért ott szándékosan kihagyjuk.
 *
 * FRISSÍTÉS-ÉRTESÍTÉS: a public/sw.js az "install" eseménynél mindig azonnal
 * `self.skipWaiting()`-et hív, vagyis egy új verzió a háttérben CSENDBEN
 * aktiválódik — de a már megnyitott lap még mindig a régi, memóriában lévő
 * JS-t futtatja, és semmi nem jelezte eddig, hogy egy frissítés elérhető.
 * Ez azt jelenti, hogy amíg a felhasználó véletlenül újra nem tölti az
 * oldalt, addig hiába adunk ki hibajavítást, ő a régi verziót használja —
 * ezt a lenti `updatefound`/`controllerchange` figyelés oldja meg egy
 * eldobható, "Frissítés" gombos toasttal (NEM automatikus, kéretlen
 * újratöltéssel, mert az félbeszakítaná a jegyzetelést).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let notified = false;
    function notifyUpdateAvailable() {
      if (notified) return;
      notified = true;
      toast.message("Új verzió érhető el", {
        description:
          "Az app egy frissebb verziója már letöltődött a háttérben — tölts újra a legújabb verzióhoz.",
        duration: Infinity,
        action: {
          label: "Frissítés",
          onClick: () => window.location.reload(),
        },
      });
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // Ha már VAN egy "waiting" worker ÉS a lapot már egy korábbi
        // verzió vezérli (nem az első telepítés), az azt jelenti, hogy egy
        // frissítés a lap megnyitása közben/előtt érkezett.
        if (registration.waiting && navigator.serviceWorker.controller) {
          notifyUpdateAvailable();
        }

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            // "installed" állapot ÉS már van aktív controller -> ez egy
            // FRISSÍTÉS (nem az app első telepítése ezen az eszközön),
            // tehát van mit jeleznünk.
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              notifyUpdateAvailable();
            }
          });
        });
      })
      .catch(() => {
        // Néma hibakezelés: service worker nélkül is teljes értékű az app,
        // csak nem lesz telepíthető/offline-képes.
      });
  }, []);

  return null;
}
