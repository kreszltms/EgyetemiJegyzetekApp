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
import type { Semester } from "@/types";

interface SemesterFormDialogProps {
  semester?: Semester;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (semesterId: string) => void;
}

export function SemesterFormDialog({
  semester,
  open,
  onOpenChange,
  onSaved,
}: SemesterFormDialogProps) {
  const addSemester = useAppStore((s) => s.addSemester);
  const updateSemester = useAppStore((s) => s.updateSemester);
  const setActiveSemester = useAppStore((s) => s.setActiveSemester);

  const [nev, setNev] = useState(semester?.nev ?? "");
  const [kezdoDatum, setKezdoDatum] = useState(semester?.kezdoDatum ?? "");
  const [zaroDatum, setZaroDatum] = useState(semester?.zaroDatum ?? "");

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setNev(semester?.nev ?? "");
      setKezdoDatum(semester?.kezdoDatum ?? "");
      setZaroDatum(semester?.zaroDatum ?? "");
    }
  }

  function handleSubmit() {
    if (!nev.trim()) return;
    if (semester) {
      updateSemester(semester.id, {
        nev: nev.trim(),
        kezdoDatum: kezdoDatum || undefined,
        zaroDatum: zaroDatum || undefined,
      });
      toast.success("Félév frissítve");
      onSaved?.(semester.id);
    } else {
      const id = addSemester({
        nev: nev.trim(),
        kezdoDatum: kezdoDatum || undefined,
        zaroDatum: zaroDatum || undefined,
      });
      setActiveSemester(id);
      toast.success("Félév létrehozva");
      onSaved?.(id);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{semester ? "Félév szerkesztése" : "Új félév"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="semester-nev">Elnevezés</Label>
            <Input
              id="semester-nev"
              autoFocus
              placeholder="pl. 2026/2027 Ősz"
              value={nev}
              onChange={(e) => setNev(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="semester-kezdo">Kezdés (opcionális)</Label>
              <Input
                id="semester-kezdo"
                type="date"
                value={kezdoDatum}
                onChange={(e) => setKezdoDatum(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="semester-zaro">Zárás (opcionális)</Label>
              <Input
                id="semester-zaro"
                type="date"
                value={zaroDatum}
                onChange={(e) => setZaroDatum(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Mégse
          </Button>
          <Button onClick={handleSubmit} disabled={!nev.trim()}>
            {semester ? "Mentés" : "Létrehozás"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
