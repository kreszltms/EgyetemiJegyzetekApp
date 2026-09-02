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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useAppStore } from "@/lib/store";
import { REQUIREMENT_TYPE_LABELS, type Requirement, type RequirementType } from "@/types";

const TYPE_OPTIONS: RequirementType[] = ["zh", "beadando", "vizsga", "egyeb"];

interface RequirementDialogProps {
  subjectId: string;
  requirement?: Requirement;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RequirementDialog({
  subjectId,
  requirement,
  open,
  onOpenChange,
}: RequirementDialogProps) {
  const addRequirement = useAppStore((s) => s.addRequirement);
  const updateRequirement = useAppStore((s) => s.updateRequirement);

  const [nev, setNev] = useState(requirement?.nev ?? "");
  const [tipus, setTipus] = useState<RequirementType>(requirement?.tipus ?? "zh");
  const [hatarido, setHatarido] = useState(requirement?.hatarido ?? "");
  const [megjegyzes, setMegjegyzes] = useState(requirement?.megjegyzes ?? "");
  const [pontSzerzett, setPontSzerzett] = useState(
    requirement?.pontszamSzerzett !== undefined ? String(requirement.pontszamSzerzett) : ""
  );
  const [pontMax, setPontMax] = useState(
    requirement?.pontszamMax !== undefined ? String(requirement.pontszamMax) : ""
  );

  // Amikor másik követelményt nyitunk meg szerkesztésre (vagy létrehozásra
  // váltunk), töltsük újra a mezőket a friss adatokkal. Ez a React
  // dokumentáció szerinti "állapot igazítása render közben" minta —
  // useEffect helyett, hogy ne okozzon felesleges extra render-kört.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setNev(requirement?.nev ?? "");
      setTipus(requirement?.tipus ?? "zh");
      setHatarido(requirement?.hatarido ?? "");
      setMegjegyzes(requirement?.megjegyzes ?? "");
      setPontSzerzett(
        requirement?.pontszamSzerzett !== undefined ? String(requirement.pontszamSzerzett) : ""
      );
      setPontMax(requirement?.pontszamMax !== undefined ? String(requirement.pontszamMax) : "");
    }
  }

  function parsePont(raw: string): number | undefined {
    const trimmed = raw.trim().replace(",", ".");
    if (!trimmed) return undefined;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : undefined;
  }

  function handleSubmit() {
    if (!nev.trim()) return;
    const patch = {
      nev: nev.trim(),
      tipus,
      hatarido: hatarido || undefined,
      megjegyzes: megjegyzes.trim() || undefined,
      pontszamSzerzett: parsePont(pontSzerzett),
      pontszamMax: parsePont(pontMax),
    };
    if (requirement) {
      updateRequirement(subjectId, requirement.id, patch);
      toast.success("Követelmény frissítve");
    } else {
      addRequirement(subjectId, patch);
      toast.success("Követelmény hozzáadva");
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {requirement ? "Követelmény szerkesztése" : "Új követelmény"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="req-nev">Megnevezés</Label>
            <Input
              id="req-nev"
              autoFocus
              placeholder="pl. 1. Zárthelyi dolgozat"
              value={nev}
              onChange={(e) => setNev(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Típus</Label>
              <Select value={tipus} onValueChange={(v) => setTipus(v as RequirementType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {REQUIREMENT_TYPE_LABELS[opt]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="req-hatarido">Határidő</Label>
              <Input
                id="req-hatarido"
                type="date"
                value={hatarido}
                onChange={(e) => setHatarido(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="req-pont-szerzett">Elért pont (opcionális)</Label>
              <Input
                id="req-pont-szerzett"
                type="number"
                inputMode="decimal"
                step="0.5"
                placeholder="pl. 17"
                value={pontSzerzett}
                onChange={(e) => setPontSzerzett(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="req-pont-max">Max. pont (opcionális)</Label>
              <Input
                id="req-pont-max"
                type="number"
                inputMode="decimal"
                step="0.5"
                placeholder="pl. 20"
                value={pontMax}
                onChange={(e) => setPontMax(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="req-megjegyzes">Megjegyzés (opcionális)</Label>
            <Textarea
              id="req-megjegyzes"
              placeholder="pl. Írásbeli + szóbeli"
              value={megjegyzes}
              onChange={(e) => setMegjegyzes(e.target.value)}
              className="min-h-16"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Mégse
          </Button>
          <Button onClick={handleSubmit} disabled={!nev.trim()}>
            {requirement ? "Mentés" : "Létrehozás"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
