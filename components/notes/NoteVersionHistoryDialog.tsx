"use client";

import { useState } from "react";
import { History, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTimeHu } from "@/lib/utils";
import type { NoteVersion } from "@/types";

interface NoteVersionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: NoteVersion[];
  onRestore: (version: NoteVersion) => void;
}

/**
 * A jegyzet korábbi cím+tartalom pillanatképeinek listája — megtekintéssel
 * és visszaállítással. A visszaállítás nem visszafordíthatatlan: a store
 * (lib/store.ts restoreNoteVersion) a visszaállítás ELŐTTI állapotot is
 * elmenti egy új pillanatképként, tehát mindig van visszaút.
 */
export function NoteVersionHistoryDialog({
  open,
  onOpenChange,
  versions,
  onRestore,
}: NoteVersionHistoryDialogProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Legújabb elöl — a `versions` tömb legrégebbi-elöl tárolt (lásd store).
  const ordered = [...versions].reverse();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Verziótörténet
          </DialogTitle>
        </DialogHeader>

        {ordered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Még nincs korábbi mentett verzió. Ahogy szerkeszted és mented a
            jegyzetet, itt fognak megjelenni a korábbi állapotok — legfeljebb
            néhány percenként egy pillanatkép, hogy gépelés közben ne teljen
            meg feleslegesen apró változásokkal.
          </p>
        ) : (
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {ordered.map((v) => {
              const expanded = expandedId === v.id;
              return (
                <div key={v.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : v.id)}
                      aria-expanded={expanded}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="truncate text-sm font-medium">
                        {v.cim || "(cím nélkül)"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateTimeHu(v.mentveKor)}
                      </div>
                    </button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 shrink-0 gap-1.5 px-2 text-xs"
                      onClick={() => onRestore(v)}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Visszaállítás
                    </Button>
                  </div>
                  {expanded && (
                    <pre className="mt-2 max-h-48 overflow-y-auto rounded-md bg-muted/40 p-2 text-xs whitespace-pre-wrap">
                      {v.tartalom || "(üres tartalom)"}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
