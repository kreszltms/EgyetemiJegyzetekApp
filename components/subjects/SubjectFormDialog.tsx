"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useAppStore } from "@/lib/store";
import { SUBJECT_ICONS, SUBJECT_ICON_NAMES } from "@/lib/subject-icons";
import { cn } from "@/lib/utils";
import type { Subject } from "@/types";

export const SZIN_PALETTA = [
  "#6366f1", // indigo
  "#0ea5e9", // sky
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#14b8a6", // teal
];

interface SubjectFormDialogProps {
  semesterId: string;
  subject?: Subject;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (subjectId: string) => void;
}

export function SubjectFormDialog({
  semesterId,
  subject,
  open,
  onOpenChange,
  onSaved,
}: SubjectFormDialogProps) {
  const addSubject = useAppStore((s) => s.addSubject);
  const updateSubject = useAppStore((s) => s.updateSubject);

  const [nev, setNev] = useState(subject?.nev ?? "");
  const [kod, setKod] = useState(subject?.kod ?? "");
  const [szin, setSzin] = useState(subject?.szin ?? SZIN_PALETTA[0]);
  const [ikon, setIkon] = useState(subject?.ikon ?? SUBJECT_ICON_NAMES[0]);
  const [maxHianyzas, setMaxHianyzas] = useState(
    String(subject?.hianyzas.maxHianyzas ?? 3)
  );
  const [kredit, setKredit] = useState(
    subject?.kredit !== undefined ? String(subject.kredit) : ""
  );

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setNev(subject?.nev ?? "");
      setKod(subject?.kod ?? "");
      setSzin(subject?.szin ?? SZIN_PALETTA[0]);
      setIkon(subject?.ikon ?? SUBJECT_ICON_NAMES[0]);
      setMaxHianyzas(String(subject?.hianyzas.maxHianyzas ?? 3));
      setKredit(subject?.kredit !== undefined ? String(subject.kredit) : "");
    }
  }

  function handleSubmit() {
    if (!nev.trim()) return;
    const parsedMax = Number.parseInt(maxHianyzas, 10);
    const maxHianyzasValue = Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : 3;
    const parsedKredit = Number(kredit.trim().replace(",", "."));
    const kreditValue =
      kredit.trim() !== "" && Number.isFinite(parsedKredit) && parsedKredit >= 0
        ? parsedKredit
        : undefined;

    if (subject) {
      updateSubject(subject.id, {
        nev: nev.trim(),
        kod: kod.trim() || "—",
        szin,
        ikon,
        hianyzas: { ...subject.hianyzas, maxHianyzas: maxHianyzasValue },
        kredit: kreditValue,
      });
      toast.success("Tárgy frissítve");
      onSaved?.(subject.id);
    } else {
      const id = addSubject({
        semesterId,
        nev: nev.trim(),
        kod: kod.trim() || "—",
        szin,
        ikon,
        hianyzas: { maxHianyzas: maxHianyzasValue, jelenlegiHianyzas: 0 },
        kredit: kreditValue,
      });
      toast.success("Tárgy létrehozva");
      onSaved?.(id);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{subject ? "Tárgy szerkesztése" : "Új tárgy"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="subject-nev">Tárgy neve</Label>
            <Input
              id="subject-nev"
              autoFocus
              placeholder="pl. Adatbázisrendszerek"
              value={nev}
              onChange={(e) => setNev(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subject-kod">Tárgykód</Label>
            <Input
              id="subject-kod"
              placeholder="pl. IK-ADB-101"
              value={kod}
              onChange={(e) => setKod(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="subject-max-hianyzas">Maximális hiányzás (óra)</Label>
              <Input
                id="subject-max-hianyzas"
                type="number"
                min={1}
                inputMode="numeric"
                placeholder="pl. 3"
                value={maxHianyzas}
                onChange={(e) => setMaxHianyzas(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subject-kredit">Kredit (opcionális)</Label>
              <Input
                id="subject-kredit"
                type="number"
                min={0}
                step="0.5"
                inputMode="decimal"
                placeholder="pl. 5"
                value={kredit}
                onChange={(e) => setKredit(e.target.value)}
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            A kredit a Kreditindex fülön a súlyozott átlag számításához kell —
            enélkül a tárgy nem számít bele.
          </p>

          <div className="space-y-1.5">
            <Label>Szín</Label>
            <div className="flex flex-wrap gap-2">
              {SZIN_PALETTA.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSzin(c)}
                  className={cn(
                    "h-7 w-7 rounded-full border-2 transition-transform",
                    szin === c ? "border-foreground scale-110" : "border-transparent"
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Szín: ${c}`}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Ikon</Label>
            <div className="grid grid-cols-8 gap-2 sm:grid-cols-9">
              {SUBJECT_ICON_NAMES.map((name) => {
                const Icon = SUBJECT_ICONS[name];
                const active = ikon === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setIkon(name)}
                    title={name}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg border transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Mégse
          </Button>
          <Button onClick={handleSubmit} disabled={!nev.trim()}>
            {subject ? "Mentés" : "Létrehozás"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
