"use client";

import "./globals.css";

// ============================================================================
// UNINOTES — Legfelső szintű hiba-elkapó (Next.js "global-error.tsx")
//
// Ez CSAK akkor fut le, ha maga a gyökér-layout (app/layout.tsx) — pl. a
// ThemeProvider vagy a Toaster inicializálása — dob hibát. Ilyenkor a
// szokásos layoutra (és annak komponenseire, pl. app/error.tsx Button-jára)
// NEM támaszkodhatunk, mert az is a hibás fába tartozik: ennek a fájlnak
// saját <html>/<body> vázat KELL adnia, és szándékosan minél kevesebb
// függőséget használ (nincs Button/lucide-react import), hogy minél kevesebb
// legyen benne, ami ismét elromolhatna.
//
// A design-tokeneket (bg-background, text-foreground stb.) a globals.css
// `:root`-ban definiált CSS-változók adják, amik JS/ThemeProvider nélkül is
// mindig léteznek — csak a sötét téma automatikus kapcsolása (a `.dark`
// osztály) marad ki, mert azt a ThemeProvider (next-themes) állítja be,
// ami itt éppen nem fut. Ez egy ritkán látott végső tartalék képernyő,
// ahol egy világos alapszín teljesen elfogadható kompromisszum.
// ============================================================================

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="hu">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center text-foreground antialiased">
        <div className="space-y-1.5">
          <h1 className="text-lg font-semibold">Váratlan hiba történt</h1>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            Az alkalmazás egy súlyos hiba miatt nem tudott elindulni. A
            jegyzeteid a böngésződben tárolódnak — ez a hiba önmagában nem
            törli őket.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Újrapróbálás
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            Teljes újratöltés
          </button>
        </div>
      </body>
    </html>
  );
}
