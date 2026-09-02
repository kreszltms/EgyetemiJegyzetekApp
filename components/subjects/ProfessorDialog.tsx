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
import type { Subject } from "@/types";

interface ProfessorDialogProps {
  subject: Subject;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfessorDialog({ subject, open, onOpenChange }: ProfessorDialogProps) {
  const updateSubject = useAppStore((s) => s.updateSubject);

  const [nev, setNev] = useState(subject.oktato.nev);
  const [email, setEmail] = useState(subject.oktato.email);
  const [fogadoora, setFogadoora] = useState(subject.oktato.fogadoora);

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setNev(subject.oktato.nev);
      setEmail(subject.oktato.email);
      setFogadoora(subject.oktato.fogadoora);
    }
  }

  function handleSubmit() {
    updateSubject(subject.id, {
      oktato: { nev: nev.trim(), email: email.trim(), fogadoora: fogadoora.trim() },
    });
    toast.success("Oktató adatai frissítve");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Oktató adatai</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="prof-nev">Név</Label>
            <Input
              id="prof-nev"
              autoFocus
              placeholder="pl. Dr. Kovács Anna"
              value={nev}
              onChange={(e) => setNev(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prof-email">Email</Label>
            <Input
              id="prof-email"
              type="email"
              placeholder="pl. kovacs.anna@egyetem.hu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prof-fogadoora">Fogadóóra</Label>
            <Input
              id="prof-fogadoora"
              placeholder="pl. Szerda 14:00–15:00, IB.214"
              value={fogadoora}
              onChange={(e) => setFogadoora(e.target.value)}
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
