"use client";

import { useEffect, useState } from "react";
import { GraduationCap, Loader2, Menu } from "lucide-react";

import { Sidebar } from "@/components/layout/Sidebar";
import { HomeOverview } from "@/components/layout/HomeOverview";
import { SubjectDashboard } from "@/components/subjects/SubjectDashboard";
import { NoteEditor } from "@/components/notes/NoteEditor";
import { GlobalNotes } from "@/components/notes/GlobalNotes";
import { CalendarView } from "@/components/calendar/CalendarView";
import { KreditIndexView } from "@/components/kreditindex/KreditIndexView";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { AuthScreen, FirebaseNotConfiguredScreen } from "@/components/auth/AuthScreen";
import { Button } from "@/components/ui/button";
import { useAuthStatus } from "@/lib/auth";
import { useCloudSync } from "@/lib/cloud-sync";
import { cn } from "@/lib/utils";
import type { Note } from "@/types";

export type Nezet =
  | { tipus: "otthon" }
  | { tipus: "targy"; subjectId: string }
  | { tipus: "osszes-jegyzet" }
  | { tipus: "naptar" }
  | { tipus: "kreditindex" }
  | { tipus: "jegyzet-szerkesztes"; subjectId: string; note?: Note };

export function AppShell() {
  const [nezet, setNezet] = useState<Nezet>({ tipus: "otthon" });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const { configured, ready, user } = useAuthStatus();

  // Csak akkor fejt ki hatást, ha van bejelentkezett felhasználó (uid) —
  // mindig meg kell hívni, hogy ne sértsük a React hooks szabályait.
  useCloudSync(user?.uid ?? null);

  // Globális Ctrl+K / Cmd+K billentyűparancs a gyorskereséshez — bárhonnan
  // elérhető, függetlenül attól, melyik nézeten állunk épp.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!configured) {
    return <FirebaseNotConfiguredScreen />;
  }

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  // Mobilon a navigáció után automatikusan zárjuk a kihúzható menüt.
  function handleNavigate(next: Nezet) {
    setNezet(next);
    setMobileNavOpen(false);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Háttér-elsötétítés mobilon, amikor a menü nyitva van */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: mobilon kihúzható panel, md-től állandó oszlop */}
      <div
        className={cn(
          // bg-background: a Sidebar saját háttere (bg-muted/20) csak
          // részben átlátszó — mobilon, ahol ez a panel a tartalom FÖLÉ
          // úszik, e nélkül átütne rajta a mögötte lévő oldal szövege.
          "fixed inset-y-0 left-0 z-50 flex h-screen w-72 shrink-0 bg-background transition-transform duration-200 ease-in-out md:static md:z-auto md:translate-x-0",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Sidebar
          nezet={nezet}
          onNavigate={handleNavigate}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        />
      </div>

      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onNavigate={handleNavigate}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobil felső sáv: hamburger menü, csak kis képernyőn látszik */}
        <div className="flex items-center gap-2 border-b px-3 py-2.5 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setMobileNavOpen((v) => !v)}
            aria-label="Menü megnyitása"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1.5">
            <GraduationCap className="h-4 w-4" />
            <span className="text-sm font-semibold">Egyetemi Jegyzetek</span>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto">
          {nezet.tipus === "otthon" && <HomeOverview onNavigate={setNezet} />}

          {nezet.tipus === "targy" && (
            <SubjectDashboard
              subjectId={nezet.subjectId}
              onNewNote={(subjectId) =>
                setNezet({ tipus: "jegyzet-szerkesztes", subjectId })
              }
              onOpenNote={(note) =>
                setNezet({ tipus: "jegyzet-szerkesztes", subjectId: note.subjectId, note })
              }
              onDeleted={() => setNezet({ tipus: "otthon" })}
            />
          )}

          {nezet.tipus === "osszes-jegyzet" && (
            <GlobalNotes
              onOpenNote={(note) =>
                setNezet({ tipus: "jegyzet-szerkesztes", subjectId: note.subjectId, note })
              }
            />
          )}

          {nezet.tipus === "naptar" && <CalendarView />}

          {nezet.tipus === "kreditindex" && <KreditIndexView onNavigate={setNezet} />}

          {nezet.tipus === "jegyzet-szerkesztes" && (
            <NoteEditor
              subjectId={nezet.subjectId}
              note={nezet.note}
              onClose={() => setNezet({ tipus: "targy", subjectId: nezet.subjectId })}
              onSaved={() => setNezet({ tipus: "targy", subjectId: nezet.subjectId })}
            />
          )}
        </main>
      </div>
    </div>
  );
}
