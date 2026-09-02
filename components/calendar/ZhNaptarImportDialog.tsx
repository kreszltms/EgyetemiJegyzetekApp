"use client";

import { useMemo, useRef, useState } from "react";
import { CalendarSearch, CheckSquare, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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
import { parseZhNaptarFile, type ZhCalendarEntry, type ZhSlot } from "@/lib/zh-naptar-xlsx";
import { formatDateHu } from "@/lib/utils";

interface ZhNaptarImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MIN_SEARCH_LEN = 2;
const MAX_RESULTS = 40;

const normalizeCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

function slotKey(entryId: string, slot: ZhSlot): string {
  return `${entryId}::${slot.label}`;
}

function slotNumber(label: ZhSlot["label"]): number {
  return Number(label.replace("ZH", "")) || 1;
}

function buildMegjegyzes(slot: ZhSlot): string {
  if (slot.isPlaceholder) {
    return `${slot.raw} — egyetemi ZH-naptárból importálva.`;
  }
  if (slot.startDate && slot.endDate && slot.startDate !== slot.endDate) {
    return `${slot.raw} — több napos időszak, nézd meg melyik nap vonatkozik rád. Egyetemi ZH-naptárból importálva.`;
  }
  return "Egyetemi ZH-naptárból importálva.";
}

export function ZhNaptarImportDialog({ open, onOpenChange }: ZhNaptarImportDialogProps) {
  const subjects = useAppStore((s) => s.subjects);
  const semesters = useAppStore((s) => s.semesters);
  const addRequirement = useAppStore((s) => s.addRequirement);

  const [loading, setLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [entries, setEntries] = useState<ZhCalendarEntry[] | null>(null);
  const [search, setSearch] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [targetSubjectByEntry, setTargetSubjectByEntry] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const semesterNevById = useMemo(
    () => new Map(semesters.map((s) => [s.id, s.nev])),
    [semesters]
  );
  const subjectsSorted = useMemo(
    () =>
      [...subjects].sort((a, b) => {
        const semA = semesterNevById.get(a.semesterId) ?? "";
        const semB = semesterNevById.get(b.semesterId) ?? "";
        return semA === semB ? a.nev.localeCompare(b.nev) : semA.localeCompare(semB);
      }),
    [subjects, semesterNevById]
  );

  function autoMatchSubjectId(targykod: string): string | undefined {
    const target = normalizeCode(targykod);
    const found = subjects.find((sub) => sub.kod && normalizeCode(sub.kod) === target);
    return found?.id;
  }

  const filteredEntries = useMemo(() => {
    if (!entries) return [];
    const q = search.trim().toLowerCase();
    if (q.length < MIN_SEARCH_LEN) return [];
    return entries
      .filter(
        (e) =>
          e.targykod.toLowerCase().includes(q) ||
          e.targynevHu.toLowerCase().includes(q) ||
          (e.targynevEn ?? "").toLowerCase().includes(q) ||
          e.cospaceId.toLowerCase().includes(q)
      )
      .slice(0, MAX_RESULTS);
  }, [entries, search]);

  const totalMatchCount = useMemo(() => {
    if (!entries) return 0;
    const q = search.trim().toLowerCase();
    if (q.length < MIN_SEARCH_LEN) return 0;
    return entries.filter(
      (e) =>
        e.targykod.toLowerCase().includes(q) ||
        e.targynevHu.toLowerCase().includes(q) ||
        (e.targynevEn ?? "").toLowerCase().includes(q) ||
        e.cospaceId.toLowerCase().includes(q)
    ).length;
  }, [entries, search]);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLoading(true);
    setFileError(null);
    const result = await parseZhNaptarFile(file);
    setLoading(false);
    if (!result.success) {
      setFileError(result.error);
      return;
    }
    setEntries(result.entries);
    setChecked(new Set());
    setTargetSubjectByEntry({});
    toast.success(`${result.entries.length} tárgy ZH-adatai betöltve — keress rá a tárgykódodra.`);
  }

  function toggleSlot(entry: ZhCalendarEntry, slot: ZhSlot, value: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      const key = slotKey(entry.id, slot);
      if (value) next.add(key);
      else next.delete(key);
      return next;
    });
    // Ha még nincs kiválasztott célt árgy ehhez a sorhoz, próbáljunk
    // automatikusan találni egyet a tárgykód alapján.
    if (value && !targetSubjectByEntry[entry.id]) {
      const auto = autoMatchSubjectId(entry.targykod);
      if (auto) {
        setTargetSubjectByEntry((prev) => ({ ...prev, [entry.id]: auto }));
      }
    }
  }

  function handleAdd() {
    if (!entries) return;
    let addedCount = 0;
    let skippedNoSubject = 0;

    for (const entry of entries) {
      const targetId = targetSubjectByEntry[entry.id];
      for (const slot of entry.slots) {
        const key = slotKey(entry.id, slot);
        if (!checked.has(key)) continue;
        if (!targetId) {
          skippedNoSubject += 1;
          continue;
        }
        addRequirement(targetId, {
          nev: `${slotNumber(slot.label)}. ZH`,
          tipus: "zh",
          hatarido: slot.startDate,
          megjegyzes: buildMegjegyzes(slot),
        });
        addedCount += 1;
      }
    }

    if (addedCount > 0) {
      toast.success(`${addedCount} ZH hozzáadva a kiválasztott tárgyakhoz.`);
    }
    if (skippedNoSubject > 0) {
      toast.error(
        `${skippedNoSubject} kiválasztott ZH-hoz nem volt megadva tárgy — azok nem kerültek hozzáadásra. Válassz tárgyat a legördülőben, és próbáld újra.`
      );
    }
    if (addedCount === 0 && skippedNoSubject === 0) return;

    // Csak a sikeresen hozzáadottakat pipáljuk ki, hogy a hiányzó tárgyú
    // sorokat könnyen újra tudja próbálni a felhasználó.
    setChecked((prev) => {
      const next = new Set(prev);
      for (const entry of entries) {
        const targetId = targetSubjectByEntry[entry.id];
        if (!targetId) continue;
        for (const slot of entry.slots) next.delete(slotKey(entry.id, slot));
      }
      return next;
    });
  }

  function handleReset() {
    setEntries(null);
    setFileError(null);
    setSearch("");
    setChecked(new Set());
    setTargetSubjectByEntry({});
  }

  const selectedCount = checked.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Egyetemi ZH-naptár importálása</DialogTitle>
        </DialogHeader>

        {!entries && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Töltsd fel az egyetem által közzétett ZH-naptár .xlsx fájlját. Utána
              tárgykód vagy tárgynév alapján kereshetsz benne, és kiválaszthatod,
              mely ZH-időpontokat add hozzá a saját tárgyaid Követelmények
              listájához. Egy tárgykódhoz több sor (pl. eltérő csoport/campus)
              is tartozhat, eltérő dátumokkal — ilyenkor a rád vonatkozót
              válaszd ki.
            </p>
            {fileError && (
              <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                {fileError}
              </p>
            )}
            <Button onClick={() => fileInputRef.current?.click()} disabled={loading} className="gap-1.5">
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {loading ? "Feldolgozás…" : "Fájl kiválasztása"}
            </Button>
          </div>
        )}

        {entries && (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <CalendarSearch className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  placeholder="Keresés tárgykód vagy tárgynév alapján…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="ghost" size="sm" onClick={handleReset}>
                Másik fájl
              </Button>
            </div>

            {search.trim().length < MIN_SEARCH_LEN && (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Írj be legalább {MIN_SEARCH_LEN} karaktert a tárgykódodból vagy a
                tárgy nevéből a kereséshez ({entries.length} tárgy áll rendelkezésre).
              </p>
            )}

            {search.trim().length >= MIN_SEARCH_LEN && filteredEntries.length === 0 && (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nincs találat erre: „{search}”.
              </p>
            )}

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              {filteredEntries.map((entry) => (
                <ZhEntryCard
                  key={entry.id}
                  entry={entry}
                  checked={checked}
                  targetSubjectId={targetSubjectByEntry[entry.id]}
                  subjects={subjectsSorted}
                  semesterNevById={semesterNevById}
                  onToggleSlot={(slot, value) => toggleSlot(entry, slot, value)}
                  onSubjectChange={(subjectId) =>
                    setTargetSubjectByEntry((prev) => ({ ...prev, [entry.id]: subjectId }))
                  }
                />
              ))}
              {totalMatchCount > filteredEntries.length && (
                <p className="px-1 text-xs text-muted-foreground">
                  {totalMatchCount - filteredEntries.length} további találat — pontosítsd a
                  keresést a szűküléshez.
                </p>
              )}
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={handleFileSelected}
        />

        {entries && (
          <DialogFooter className="flex-row items-center justify-between sm:justify-between">
            <span className="text-xs text-muted-foreground">
              {selectedCount > 0 ? `${selectedCount} ZH kiválasztva` : "Nincs kiválasztott ZH"}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Bezárás
              </Button>
              <Button onClick={handleAdd} disabled={selectedCount === 0} className="gap-1.5">
                <CheckSquare className="h-3.5 w-3.5" />
                Kiválasztottak hozzáadása
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------------------------------

function ZhEntryCard({
  entry,
  checked,
  targetSubjectId,
  subjects,
  semesterNevById,
  onToggleSlot,
  onSubjectChange,
}: {
  entry: ZhCalendarEntry;
  checked: Set<string>;
  targetSubjectId: string | undefined;
  subjects: { id: string; nev: string; kod: string; semesterId: string; szin: string }[];
  semesterNevById: Map<string, string>;
  onToggleSlot: (slot: ZhSlot, value: boolean) => void;
  onSubjectChange: (subjectId: string) => void;
}) {
  return (
    <div className="rounded-xl border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium text-foreground">{entry.targynevHu}</span>
            <Badge variant="outline" className="font-mono text-[10px]">
              {entry.targykod}
            </Badge>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {entry.campus && <span>{entry.campus}</span>}
            {entry.kurzusAzonosito && (
              <span className="font-mono text-[10px] text-muted-foreground/80">
                {entry.kurzusAzonosito}
              </span>
            )}
          </div>
        </div>

        <Select value={targetSubjectId ?? ""} onValueChange={onSubjectChange}>
          <SelectTrigger size="sm" className="w-48 shrink-0">
            <SelectValue placeholder="Válassz tárgyat…" />
          </SelectTrigger>
          <SelectContent>
            {subjects.map((sub) => (
              <SelectItem key={sub.id} value={sub.id}>
                {semesterNevById.get(sub.semesterId)
                  ? `${semesterNevById.get(sub.semesterId)} — ${sub.nev}`
                  : sub.nev}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-2.5 space-y-1.5">
        {entry.slots.map((slot) => {
          const key = slotKey(entry.id, slot);
          const isChecked = checked.has(key);
          return (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted/50"
            >
              <Checkbox
                checked={isChecked}
                onCheckedChange={(v) => onToggleSlot(slot, v === true)}
              />
              <span className="font-medium text-foreground">{slot.label}</span>
              <span className={slot.isPlaceholder ? "text-muted-foreground italic" : "text-foreground"}>
                {slot.isPlaceholder
                  ? "A tantárgyleírás szerint (nincs konkrét dátum)"
                  : slot.startDate === slot.endDate
                  ? formatDateHu(slot.startDate)
                  : `${formatDateHu(slot.startDate)} – ${formatDateHu(slot.endDate)}`}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
