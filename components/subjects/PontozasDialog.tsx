"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useAppStore } from "@/lib/store";
import { formatGrade, getPontozas } from "@/lib/pontozas";
import { DEFAULT_PONTOZAS, type Subject } from "@/types";

interface PontozasDialogProps {
  subject: Subject;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** A négy szerkeszthető jegyhatár (2-5-ös); az 1-es mindig "ami ez alatt van". */
const JEGYEK = [2, 3, 4, 5];

function buildInitialHatarState(subject: Subject): Record<number, string> {
  const pontozas = getPontozas(subject.pontozas);
  const byJegy = new Map(pontozas.hatarok.map((h) => [h.jegy, h.minPont]));
  const state: Record<number, string> = {};
  for (const jegy of JEGYEK) {
    const fallback = DEFAULT_PONTOZAS.hatarok.find((h) => h.jegy === jegy)?.minPont ?? 0;
    state[jegy] = String(byJegy.get(jegy) ?? fallback);
  }
  return state;
}

export function PontozasDialog({ subject, open, onOpenChange }: PontozasDialogProps) {
  const updateSubject = useAppStore((s) => s.updateSubject);

  const [maxOsszpontszam, setMaxOsszpontszam] = useState(
    String(getPontozas(subject.pontozas).maxOsszpontszam)
  );
  const [hatarok, setHatarok] = useState<Record<number, string>>(() =>
    buildInitialHatarState(subject)
  );
  const [megjegyzes, setMegjegyzes] = useState(getPontozas(subject.pontozas).megjegyzes ?? "");

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setMaxOsszpontszam(String(getPontozas(subject.pontozas).maxOsszpontszam));
      setHatarok(buildInitialHatarState(subject));
      setMegjegyzes(getPontozas(subject.pontozas).megjegyzes ?? "");
    }
  }

  function handleSubmit() {
    const parsedMax = Number(maxOsszpontszam.trim().replace(",", "."));
    updateSubject(subject.id, {
      pontozas: {
        maxOsszpontszam: Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : 100,
        hatarok: JEGYEK.map((jegy) => {
          const raw = Number((hatarok[jegy] ?? "").replace(",", "."));
          const fallback = DEFAULT_PONTOZAS.hatarok.find((h) => h.jegy === jegy)?.minPont ?? 0;
          return { jegy, minPont: Number.isFinite(raw) ? raw : fallback };
        }),
        megjegyzes: megjegyzes.trim() || undefined,
      },
    });
    toast.success("Pontozás frissítve");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pontozás szerkesztése</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pontozas-max">Elméletileg elérhető max. összpontszám</Label>
            <Input
              id="pontozas-max"
              type="number"
              inputMode="decimal"
              step="0.5"
              value={maxOsszpontszam}
              onChange={(e) => setMaxOsszpontszam(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Ha vannak pluszpontszerzési lehetőségek, ez lehet 100 fölötti is (pl. 110).
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Jegyhatárok (ettől a pontszámtól jár az adott jegy)</Label>
            <div className="space-y-2">
              {JEGYEK.map((jegy) => (
                <div key={jegy} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-sm text-muted-foreground">
                    {formatGrade(jegy)}:
                  </span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    value={hatarok[jegy] ?? ""}
                    onChange={(e) => setHatarok((prev) => ({ ...prev, [jegy]: e.target.value }))}
                  />
                  <span className="shrink-0 text-xs text-muted-foreground">ponttól</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Az ez alatti pontszám elégtelen (1-es). Tárgyanként eltérő beosztás is megadható.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pontozas-megjegyzes">
              Megjegyzés — hogyan/mikor szerezhetők (plusz)pontok
            </Label>
            <Textarea
              id="pontozas-megjegyzes"
              placeholder="pl. A 2. ZH-n elért 90% fölötti eredmény +5 pluszpontot ér; órai aktivitásért félévente max 3 pont adható."
              value={megjegyzes}
              onChange={(e) => setMegjegyzes(e.target.value)}
              className="min-h-20"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Mégse
          </Button>
          <Button onClick={handleSubmit}>Mentés</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
