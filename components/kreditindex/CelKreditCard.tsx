"use client";

import { useState } from "react";
import { Pencil, Target } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useAppStore } from "@/lib/store";

// ============================================================================
// EGYETEMI JEGYZETEK — Diplomához szükséges kredit-tervező
// A felhasználó megadja, hány kredit kell összesen az okleveléhez, ez a
// kártya pedig ehhez viszonyítja a ténylegesen MEGSZERZETT (legalább 2-es
// jegyű) kreditet, és a félévenkénti átlagos tempó alapján durván megbecsüli,
// hány félév van még hátra. Csak becslés — a valós mintatantervi
// előírásokat (kötelező/kötelezően választandó/szabadon választható
// kreditkeretek) nem ismeri, egyetlen összesített célszámmal dolgozik.
// ============================================================================

export function CelKreditCard({
  earnedKredit,
  atlagKreditFelevente,
}: {
  earnedKredit: number;
  atlagKreditFelevente: number | null;
}) {
  const celKredit = useAppStore((s) => s.celKredit);
  const setCelKredit = useAppStore((s) => s.setCelKredit);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function handleSave() {
    const parsed = Number(draft.trim().replace(",", "."));
    if (!draft.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Adj meg egy pozitív kreditszámot.");
      return;
    }
    setCelKredit(Math.round(parsed));
    setEditing(false);
    toast.success("Cél kredit mentve");
  }

  if (celKredit == null && !editing) {
    return (
      <Card className="border-dashed shadow-none">
        <CardContent className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
          <Target className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Add meg, hány kredit kell összesen az okleveledhez, és ez a kártya
            mutatja majd, hol tartasz és kb. hány féléved van hátra.
          </p>
          <Button
            size="sm"
            onClick={() => {
              setDraft("");
              setEditing(true);
            }}
          >
            Cél kredit beállítása
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (editing) {
    return (
      <Card className="border-none shadow-sm">
        <CardContent className="flex h-full flex-col justify-center gap-2 p-6">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Diplomához szükséges kredit
          </span>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              step={1}
              autoFocus
              placeholder="pl. 180"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              className="h-9 w-28"
            />
            <span className="text-sm text-muted-foreground">kredit</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave}>
              Mentés
            </Button>
            {celKredit != null && (
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                Mégse
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const percent = Math.min(100, Math.round((earnedKredit / celKredit!) * 100));
  const hatralevo = Math.max(0, celKredit! - earnedKredit);
  const becsultFelev =
    hatralevo > 0 && atlagKreditFelevente && atlagKreditFelevente > 0
      ? Math.ceil(hatralevo / atlagKreditFelevente)
      : null;

  return (
    <Card className="border-none shadow-sm">
      <CardContent className="flex h-full flex-col gap-3 p-6">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Diplomához szükséges kredit
          </span>
          <button
            onClick={() => {
              setDraft(String(celKredit));
              setEditing(true);
            }}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Cél kredit szerkesztése"
            title="Cél kredit szerkesztése"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-semibold tabular-nums">{earnedKredit}</span>
          <span className="text-sm text-muted-foreground">/ {celKredit} kredit</span>
        </div>

        <Progress value={percent} />

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{percent}% teljesítve</span>
          {hatralevo === 0 ? (
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              Megvan a szükséges kredit!
            </span>
          ) : becsultFelev !== null ? (
            <span>kb. még {becsultFelev} félév a jelenlegi tempó mellett</span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
