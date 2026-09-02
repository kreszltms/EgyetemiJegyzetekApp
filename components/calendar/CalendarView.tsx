"use client";

import { useMemo, useRef, useState } from "react";
import { CalendarDays, CalendarSearch, Download, Trash2, Upload, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import { ScheduleList } from "@/components/calendar/ScheduleList";
import { ZhNaptarImportDialog } from "@/components/calendar/ZhNaptarImportDialog";
import { useAppStore } from "@/lib/store";
import { parseNeptunScheduleFile } from "@/lib/neptun-xlsx";
import { parseIcsFile } from "@/lib/ics-import";
import { buildCalendarItems, formatDateKeyHu, todayDateKey } from "@/lib/calendar-helpers";
import { downloadIcsCalendar } from "@/lib/ics-export";

export function CalendarView() {
  const scheduleEvents = useAppStore((s) => s.scheduleEvents);
  const subjects = useAppStore((s) => s.subjects);
  const importScheduleEvents = useAppStore((s) => s.importScheduleEvents);
  const importIcsEvents = useAppStore((s) => s.importIcsEvents);
  const clearSchedule = useAppStore((s) => s.clearSchedule);

  const [importing, setImporting] = useState(false);
  const [icsImporting, setIcsImporting] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [zhDialogOpen, setZhDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const icsFileInputRef = useRef<HTMLInputElement>(null);

  const allItems = useMemo(
    () => buildCalendarItems(scheduleEvents, subjects),
    [scheduleEvents, subjects]
  );

  const upcomingItems = useMemo(() => {
    const today = todayDateKey();
    return allItems.filter((item) => item.dateKey >= today);
  }, [allItems]);

  const selectedDayItems = useMemo(
    () => (selectedDateKey ? allItems.filter((i) => i.dateKey === selectedDateKey) : []),
    [allItems, selectedDateKey]
  );

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    const result = await parseNeptunScheduleFile(file);
    setImporting(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    const { imported, matched } = importScheduleEvents(result.events);
    toast.success(
      matched > 0
        ? `${imported} óra importálva — ebből ${matched} automatikusan összekapcsolva a tárgyaiddal.`
        : `${imported} óra importálva.`
    );
  }

  async function handleIcsFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setIcsImporting(true);
    const result = await parseIcsFile(file);
    setIcsImporting(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    const { imported, matched, skipped } = importIcsEvents(result.events);
    if (imported === 0) {
      toast.info("Nincs új esemény — ez a naptár már be volt importálva.");
      return;
    }
    const skippedPart = skipped > 0 ? ` (${skipped} már korábban importált esemény kimaradt)` : "";
    toast.success(
      matched > 0
        ? `${imported} esemény importálva — ebből ${matched} automatikusan összekapcsolva a tárgyaiddal.${skippedPart}`
        : `${imported} esemény importálva.${skippedPart}`
    );
  }

  function handleClearSchedule() {
    clearSchedule();
    setClearConfirmOpen(false);
    toast.success("Az importált órarend törölve.");
  }

  function handleExportIcs() {
    downloadIcsCalendar(allItems);
    toast.success("Naptár exportálva (.ics) — importáld be a saját naptáralkalmazásodba.");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Naptár</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A Neptunból importált órarended és a nyitott ZH/vizsga határidőid egy helyen.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {scheduleEvents.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setClearConfirmOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Órarend törlése
            </Button>
          )}
          {allItems.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExportIcs}>
              <Download className="h-3.5 w-3.5" />
              Exportálás (.ics)
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZhDialogOpen(true)}
          >
            <CalendarSearch className="h-3.5 w-3.5" />
            Egyetemi ZH-naptár
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => icsFileInputRef.current?.click()}
            disabled={icsImporting}
          >
            <UploadCloud className="h-3.5 w-3.5" />
            {icsImporting ? "Feldolgozás…" : "Naptár importálása (.ics)"}
          </Button>
          <input
            ref={icsFileInputRef}
            type="file"
            accept=".ics,text/calendar"
            className="hidden"
            onChange={handleIcsFileSelected}
          />
          <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing}>
            <Upload className="h-3.5 w-3.5" />
            {importing ? "Feldolgozás…" : "Órarend importálása"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={handleFileSelected}
          />
        </div>
      </div>

      {scheduleEvents.length === 0 && (
        <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Még nincs importált órarended.</p>
          <p className="mt-1">
            A Neptunban az órarended „Tanóra” exportját (.xlsx) töltsd le, majd itt add hozzá
            az „Órarend importálása” gombbal. A ZH-kat felveheted kézzel a tárgyaknál a
            „Követelmények” alatt, vagy az „Egyetemi ZH-naptár” gombbal az egyetem
            hivatalos ZH-naptárából, tárgykód alapján — mindkettő itt is megjelenik. Egy
            külső (pl. egyetemi) naptár .ics fájlját is beimportálhatod a „Naptár importálása
            (.ics)” gombbal.
          </p>
        </div>
      )}

      <Tabs defaultValue="havi">
        <TabsList>
          <TabsTrigger value="havi">
            <CalendarDays className="h-3.5 w-3.5" />
            Havi nézet
          </TabsTrigger>
          <TabsTrigger value="lista">Lista nézet</TabsTrigger>
        </TabsList>

        <TabsContent value="havi" className="space-y-4">
          <MonthGrid
            items={allItems}
            selectedDateKey={selectedDateKey}
            onSelectDay={setSelectedDateKey}
          />
          {selectedDateKey && (
            <div>
              <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {formatDateKeyHu(selectedDateKey)}
              </h3>
              <ScheduleList items={selectedDayItems} emptyText="Nincs esemény ezen a napon." />
            </div>
          )}
        </TabsContent>

        <TabsContent value="lista">
          <ScheduleList items={upcomingItems} emptyText="Nincs közelgő órád vagy határidőd." />
        </TabsContent>
      </Tabs>

      <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Biztosan törlöd az importált órarendet?</AlertDialogTitle>
            <AlertDialogDescription>
              Ez csak az importált tanórákat törli — a tárgyaid, jegyzeteid és a
              követelmény-határidőid megmaradnak. Ez a művelet nem vonható vissza.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Mégse</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleClearSchedule}
            >
              Törlés
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ZhNaptarImportDialog open={zhDialogOpen} onOpenChange={setZhDialogOpen} />
    </div>
  );
}
