"use client";

import { useMemo, useState } from "react";
import {
  Mail,
  Clock,
  Plus,
  Search,
  Tag as TagIcon,
  X,
  CheckCircle2,
  Circle,
  Presentation,
  FileText,
  FlaskConical,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

import { MarkdownContent } from "@/components/notes/MarkdownContent";
import { ProfessorDialog } from "@/components/subjects/ProfessorDialog";
import { RequirementDialog } from "@/components/subjects/RequirementDialog";
import { SubjectFormDialog } from "@/components/subjects/SubjectFormDialog";
import { PontozasCard } from "@/components/subjects/PontozasCard";

import { useAppStore } from "@/lib/store";
import { SUBJECT_ICONS } from "@/lib/subject-icons";
import { formatRequirementPont } from "@/lib/pontozas";
import {
  NOTE_CATEGORY_LABELS,
  REQUIREMENT_TYPE_LABELS,
  type Note,
  type NoteCategory,
  type Requirement,
} from "@/types";
import { attendanceStatus, calcPercentage, cn, formatDateHu } from "@/lib/utils";
import type { ElementType } from "react";

const CATEGORY_ICONS: Record<NoteCategory, ElementType> = {
  eloadas: Presentation,
  gyakorlat: FileText,
  labor: FlaskConical,
  egyeb: FileText,
};

interface SubjectDashboardProps {
  subjectId: string;
  onNewNote: (subjectId: string) => void;
  onOpenNote: (note: Note) => void;
  /** A tárgy törlése után hívódik, hogy a szülő elnavigáljon máshova */
  onDeleted: () => void;
}

export function SubjectDashboard({
  subjectId,
  onNewNote,
  onOpenNote,
  onDeleted,
}: SubjectDashboardProps) {
  const subject = useAppStore((s) => s.subjects.find((sub) => sub.id === subjectId));

  // A store nyers `notes` tömbjét szelektáljuk (stabil referencia), a
  // tárgyhoz tartozó szűrt+rendezett listát lokálisan számoljuk `useMemo`-val
  // — így a selector sosem ad vissza új tömb-referenciát minden hívásnál,
  // ami `useSyncExternalStore` alatt végtelen render-ciklushoz vezetne.
  const allNotes = useAppStore((s) => s.notes);
  const notes = useMemo(
    () =>
      allNotes
        .filter((n) => n.subjectId === subjectId)
        .sort((a, b) => (a.datum < b.datum ? 1 : -1)),
    [allNotes, subjectId]
  );

  const toggleRequirement = useAppStore((s) => s.toggleRequirement);
  const deleteRequirement = useAppStore((s) => s.deleteRequirement);
  const deleteNote = useAppStore((s) => s.deleteNote);
  const deleteSubject = useAppStore((s) => s.deleteSubject);
  const incrementHianyzas = useAppStore((s) => s.incrementHianyzas);
  const decrementHianyzas = useAppStore((s) => s.decrementHianyzas);

  const [activeTab, setActiveTab] = useState<"jegyzetek" | "kovetelmenyek">("jegyzetek");
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const [editSubjectOpen, setEditSubjectOpen] = useState(false);
  const [deleteSubjectOpen, setDeleteSubjectOpen] = useState(false);
  const [professorOpen, setProfessorOpen] = useState(false);
  const [requirementDialog, setRequirementDialog] = useState<
    { open: boolean; requirement?: Requirement }
  >({ open: false });
  const [deleteRequirementTarget, setDeleteRequirementTarget] = useState<Requirement>();
  const [deleteNoteTarget, setDeleteNoteTarget] = useState<Note>();

  // A "..." menük (tárgy műveletek / jegyzet műveletek) explicit,
  // kontrollált nyitva-tartása: ha egy menüpont egy dialógust nyit meg
  // `onSelect` + `preventDefault`-tal (ez a szokásos minta AlertDialog
  // előtt, hogy elkerüljük a Radix fókusz-versenyhelyzetet), a menü maga
  // nem záródna be automatikusan — enélkül a mögötte lévő dialógus
  // bezárása után a menü "kísértetként" újra megjelenne.
  const [subjectMenuOpen, setSubjectMenuOpen] = useState(false);
  const [openNoteMenuId, setOpenNoteMenuId] = useState<string | null>(null);

  const allTags = useMemo(
    () => Array.from(new Set(notes.flatMap((n) => n.cimkek))).sort(),
    [notes]
  );

  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      const matchesSearch =
        search.trim() === "" ||
        n.cim.toLowerCase().includes(search.toLowerCase()) ||
        n.tartalom.toLowerCase().includes(search.toLowerCase());
      const matchesTag = !activeTag || n.cimkek.includes(activeTag);
      return matchesSearch && matchesTag;
    });
  }, [notes, search, activeTag]);

  if (!subject) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Ez a tárgy nem található — lehet, hogy törölve lett.
        </div>
      </div>
    );
  }

  const requirementsDone = subject.kovetelmenyek.filter((r) => r.teljesitve).length;
  const requirementsTotal = subject.kovetelmenyek.length;
  const requirementPct = calcPercentage(requirementsDone, requirementsTotal);
  const attendance = attendanceStatus(
    subject.hianyzas.jelenlegiHianyzas,
    subject.hianyzas.maxHianyzas
  );
  const SubjectIcon = SUBJECT_ICONS[subject.ikon] ?? SUBJECT_ICONS.BookOpen;

  // A +1 hiányzás után, ha ezzel átlépjük a figyelmeztetési/túllépési
  // küszöböt, toasttal is jelezzük — a kártyán lévő szín/progress-sáv
  // csak akkor tűnik fel, ha éppen ott nézel.
  function handleIncrementHianyzas() {
    const s = subject!;
    const before = attendanceStatus(s.hianyzas.jelenlegiHianyzas, s.hianyzas.maxHianyzas);
    incrementHianyzas(s.id);
    const after = attendanceStatus(s.hianyzas.jelenlegiHianyzas + 1, s.hianyzas.maxHianyzas);
    if (after.variant === "danger" && before.variant !== "danger") {
      toast.error(`${s.nev}: túllépted a maximális hiányzást!`);
    } else if (after.variant === "warning" && before.variant === "ok") {
      toast.warning(`${s.nev}: közeledsz a maximális hiányzáshoz.`);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 sm:p-8">
      {/* ---------------------------------------------------------------- */}
      {/* FEJLÉC — tárgy alapadatai + statisztikák                          */}
      {/* ---------------------------------------------------------------- */}
      <Card className="border-none shadow-sm">
        <CardHeader className="flex flex-col gap-4 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white"
              style={{ backgroundColor: subject.szin }}
            >
              <SubjectIcon className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                  {subject.nev}
                </h1>
                <Badge variant="secondary" className="font-mono text-xs">
                  {subject.kod}
                </Badge>
              </div>
              <div className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:gap-4">
                <span className="font-medium text-foreground/80">
                  {subject.oktato.nev || "Oktató nincs megadva"}
                </span>
                {subject.oktato.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" />
                    {subject.oktato.email}
                  </span>
                )}
                {subject.oktato.fogadoora && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {subject.oktato.fogadoora}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" className="gap-1.5" onClick={() => onNewNote(subject.id)}>
              <Plus className="h-4 w-4" />
              Új jegyzet
            </Button>
            <DropdownMenu open={subjectMenuOpen} onOpenChange={setSubjectMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Tárgy műveletek">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setSubjectMenuOpen(false);
                    setEditSubjectOpen(true);
                  }}
                >
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Szerkesztés
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={(e) => {
                    e.preventDefault();
                    setSubjectMenuOpen(false);
                    setDeleteSubjectOpen(true);
                  }}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Törlés
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="grid grid-cols-1 gap-4 pt-0 sm:grid-cols-2">
          {/* Hiányzás számláló */}
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Hiányzások</span>
              <Badge
                variant={
                  attendance.variant === "danger"
                    ? "destructive"
                    : attendance.variant === "warning"
                    ? "outline"
                    : "secondary"
                }
                className="text-xs"
              >
                {attendance.label}
              </Badge>
            </div>
            <Progress
              value={calcPercentage(
                subject.hianyzas.jelenlegiHianyzas,
                subject.hianyzas.maxHianyzas
              )}
              className={cn(
                "h-2",
                attendance.variant === "danger" && "[&>div]:bg-destructive",
                attendance.variant === "warning" && "[&>div]:bg-amber-500"
              )}
            />
            <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {subject.hianyzas.jelenlegiHianyzas} / {subject.hianyzas.maxHianyzas} óra
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => decrementHianyzas(subject.id)}
                >
                  −
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleIncrementHianyzas}
                >
                  +
                </Button>
              </div>
            </div>
          </div>

          {/* Követelmény teljesítettség */}
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Követelmények</span>
              <span className="text-xs text-muted-foreground">{requirementPct}%</span>
            </div>
            <Progress value={requirementPct} className="h-2" />
            <div className="mt-2 text-sm text-muted-foreground">
              {requirementsDone} / {requirementsTotal} teljesítve
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/* TABOK — Jegyzetek / Követelmények & Infók                          */}
      {/* ---------------------------------------------------------------- */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="jegyzetek">Jegyzetek</TabsTrigger>
          <TabsTrigger value="kovetelmenyek">Követelmények &amp; Infók</TabsTrigger>
        </TabsList>

        {/* ---------------- JEGYZETEK TAB ---------------- */}
        <TabsContent value="jegyzetek" className="mt-4 space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Keresés a jegyzetek között…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <TagIcon className="h-3.5 w-3.5 text-muted-foreground" />
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                    activeTag === tag
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  )}
                >
                  #{tag}
                </button>
              ))}
              {activeTag && (
                <button
                  onClick={() => setActiveTag(null)}
                  className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                  Szűrő törlése
                </button>
              )}
            </div>
          )}

          <div className="space-y-3">
            {filteredNotes.length === 0 && (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                Nincs a szűrésnek megfelelő jegyzet. Hozz létre egyet az „Új
                jegyzet” gombbal!
              </div>
            )}

            {filteredNotes.map((note) => {
              const Icon = CATEGORY_ICONS[note.tipus];
              return (
                <Card
                  key={note.id}
                  className="cursor-pointer border shadow-none transition-colors hover:bg-muted/40"
                  onClick={() => onOpenNote(note)}
                >
                  <CardContent className="flex items-start justify-between gap-3 p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-medium text-foreground">{note.cim}</h3>
                          <Badge variant="outline" className="text-[10px]">
                            {NOTE_CATEGORY_LABELS[note.tipus]}
                          </Badge>
                        </div>
                        <MarkdownContent
                          content={note.tartalom}
                          inline
                          className="mt-1 line-clamp-2 text-sm text-muted-foreground"
                        />
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {formatDateHu(note.datum)}
                          </span>
                          {note.cimkek.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <DropdownMenu
                      open={openNoteMenuId === note.id}
                      onOpenChange={(v) => setOpenNoteMenuId(v ? note.id : null)}
                    >
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      {/* onClick stopPropagation itt: a menü tartalma Radix Portalon
                          keresztül a body-ba render­elődik, de React-fa szerint így is
                          a kártya (Card) leszármazottja marad — kattintás nélküle
                          "átbuborékolna" a Card onClick-jéig, és megnyitná a
                          szerkesztőt a Törlés gomb megnyomásakor is. */}
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            setOpenNoteMenuId(null);
                            onOpenNote(note);
                          }}
                        >
                          Szerkesztés
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={(e) => {
                            e.preventDefault();
                            setOpenNoteMenuId(null);
                            setDeleteNoteTarget(note);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Törlés
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ---------------- KÖVETELMÉNYEK & INFÓK TAB ---------------- */}
        <TabsContent value="kovetelmenyek" className="mt-4 space-y-4">
          <Card className="shadow-none">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <h3 className="text-sm font-medium text-foreground">Oktató adatai</h3>
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setProfessorOpen(true)}>
                <Pencil className="h-3.5 w-3.5" />
                Szerkesztés
              </Button>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
              <InfoField label="Név" value={subject.oktato.nev || "—"} />
              <InfoField label="Email" value={subject.oktato.email || "—"} />
              <InfoField label="Fogadóóra" value={subject.oktato.fogadoora || "—"} />
            </CardContent>
          </Card>

          <PontozasCard subject={subject} />

          <Card className="shadow-none">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <h3 className="text-sm font-medium text-foreground">Követelmények listája</h3>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setRequirementDialog({ open: true, requirement: undefined })}
              >
                <Plus className="h-3.5 w-3.5" />
                Új követelmény
              </Button>
            </CardHeader>
            <CardContent className="space-y-1 pt-0">
              {subject.kovetelmenyek.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Még nincs rögzített követelmény ehhez a tárgyhoz.
                </p>
              )}
              {subject.kovetelmenyek.map((req) => (
                <RequirementRow
                  key={req.id}
                  requirement={req}
                  onToggle={() => toggleRequirement(subject.id, req.id)}
                  onEdit={() => setRequirementDialog({ open: true, requirement: req })}
                  onDelete={() => setDeleteRequirementTarget(req)}
                />
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ---------------------------------------------------------------- */}
      {/* DIALÓGUSOK                                                         */}
      {/* ---------------------------------------------------------------- */}
      <SubjectFormDialog
        open={editSubjectOpen}
        onOpenChange={setEditSubjectOpen}
        semesterId={subject.semesterId}
        subject={subject}
      />

      <ProfessorDialog open={professorOpen} onOpenChange={setProfessorOpen} subject={subject} />

      <RequirementDialog
        subjectId={subject.id}
        requirement={requirementDialog.requirement}
        open={requirementDialog.open}
        onOpenChange={(open) => setRequirementDialog((prev) => ({ ...prev, open }))}
      />

      <AlertDialog open={deleteSubjectOpen} onOpenChange={setDeleteSubjectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Biztosan törlöd ezt a tárgyat?</AlertDialogTitle>
            <AlertDialogDescription>
              „{subject.nev}” törlésével az összes hozzá tartozó jegyzet is
              véglegesen törlődik. Ez a művelet nem vonható vissza.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Mégse</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                deleteSubject(subject.id);
                toast.success(`„${subject.nev}” törölve`);
                onDeleted();
              }}
            >
              Törlés
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteRequirementTarget}
        onOpenChange={(v) => !v && setDeleteRequirementTarget(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Törlöd ezt a követelményt?</AlertDialogTitle>
            <AlertDialogDescription>
              „{deleteRequirementTarget?.nev}” véglegesen törlődik.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Mégse</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (deleteRequirementTarget) {
                  deleteRequirement(subject.id, deleteRequirementTarget.id);
                  toast.success("Követelmény törölve");
                }
                setDeleteRequirementTarget(undefined);
              }}
            >
              Törlés
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteNoteTarget} onOpenChange={(v) => !v && setDeleteNoteTarget(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Törlöd ezt a jegyzetet?</AlertDialogTitle>
            <AlertDialogDescription>
              „{deleteNoteTarget?.cim}” véglegesen törlődik.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Mégse</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (deleteNoteTarget) {
                  deleteNote(deleteNoteTarget.id);
                  toast.success("Jegyzet törölve");
                }
                setDeleteNoteTarget(undefined);
              }}
            >
              Törlés
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Kisebb belső komponensek
// ----------------------------------------------------------------------------

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className="mt-0.5 text-foreground">{value}</div>
    </div>
  );
}

function RequirementRow({
  requirement,
  onToggle,
  onEdit,
  onDelete,
}: {
  requirement: Requirement;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/40">
      <div className="flex min-w-0 items-center gap-3">
        <button onClick={onToggle} className="shrink-0">
          {requirement.teljesitve ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
        <div className="min-w-0">
          <div
            className={cn(
              "truncate text-sm font-medium text-foreground",
              requirement.teljesitve && "text-muted-foreground line-through"
            )}
          >
            {requirement.nev}
          </div>
          {requirement.megjegyzes && (
            <div className="truncate text-xs text-muted-foreground">
              {requirement.megjegyzes}
            </div>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant="secondary" className="text-[10px]">
          {REQUIREMENT_TYPE_LABELS[requirement.tipus]}
        </Badge>
        {formatRequirementPont(requirement.pontszamSzerzett, requirement.pontszamMax) && (
          <Badge variant="outline" className="font-mono text-[10px]">
            {formatRequirementPont(requirement.pontszamSzerzett, requirement.pontszamMax)}
          </Badge>
        )}
        {requirement.hatarido && (
          <span className="text-xs text-muted-foreground">
            {formatDateHu(requirement.hatarido)}
          </span>
        )}
        <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default SubjectDashboard;
