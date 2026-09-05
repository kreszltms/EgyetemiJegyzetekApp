"use client";

import { useEffect } from "react";
import { AlertTriangle, Download, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

// ============================================================================
// UNINOTES — Hiba-elkapó képernyő (Next.js App Router "error.tsx" konvenció)
//
// MIÉRT KELLETT EZ: enélkül, ha bármelyik komponens futás közben kivételt
// dobott (pl. egy sérült localStorage-bejegyzés, egy hiányzó mező egy régi
// felhő-mentésben, vagy egy váratlan null-hivatkozás egy jegyzetben), a
// felhasználó egy üres vagy angol nyelvű, semmitmondó Next.js hibaoldalt
// látott volna — mentési vagy visszatérési lehetőség nélkül.
//
// Ez a fájl a segmens `children`-je HELYÉRE kerül, a gyökér-layout
// (app/layout.tsx) — és így a ThemeProvider/Toaster — továbbra is fölötte
// fut, ezért nyugodtan használhat UI-komponenseket (Button, lucide-react
// ikonok stb.). Súlyosabb, magát a gyökér-layoutot érintő hibákhoz lásd
// app/global-error.tsx.
//
// ADATVESZTÉS SZEMPONTJÁBÓL FONTOS: az adatok localStorage-ban (és
// opcionálisan Firestore-ban) élnek, NEM ennek a React-fának a memóriájában
// — egy render-hiba tehát önmagában NEM törli a mentett jegyzeteket. A
// "Biztonsági mentés letöltése" gombot ennek ellenére try/catch-be
// csomagoljuk lent, arra az esetre, ha épp maga a store betöltése hibázott.
// ============================================================================

export default function ErrorScreen({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Fejlesztői célú naplózás — külön hibakövető szolgáltatás (pl. Sentry)
    // ehhez a projekthez jelenleg nincs bekötve, de a konzolba mindenképp
    // kerüljön bele, hátha a felhasználó meg tudja osztani a hibaüzenetet.
    console.error("[UniNotes] Váratlan hiba történt:", error);
  }, [error]);

  async function handleBackupDownload() {
    try {
      const { downloadJsonBackup } = await import("@/lib/store");
      downloadJsonBackup();
    } catch {
      // Ha maga a store sem érhető el innen, nincs mit tenni ezen a
      // képernyőn — a localStorage-ban lévő nyers adat a böngésző
      // fejlesztői eszközeivel (Alkalmazás/Application > Local Storage)
      // ekkor is elérhető és kimenthető marad.
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-lg font-semibold">Váratlan hiba történt</h1>
        <p className="text-sm text-muted-foreground">
          Valami elromlott az alkalmazás egy részében. A jegyzeteid ettől
          még nem vesztek el — a böngésződben (és ha be van kapcsolva, a
          felhőben) tárolódnak, nem ennek az oldalnak a memóriájában.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
        <Button onClick={() => reset()} className="gap-1.5">
          <RotateCcw className="h-4 w-4" />
          Újrapróbálás
        </Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Teljes újratöltés
        </Button>
        <Button variant="ghost" onClick={handleBackupDownload} className="gap-1.5">
          <Download className="h-4 w-4" />
          Biztonsági mentés letöltése
        </Button>
      </div>
      {error.digest && (
        <p className="pt-2 text-xs text-muted-foreground/70">
          Hibaazonosító: {error.digest}
        </p>
      )}
    </div>
  );
}
