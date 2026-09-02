"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  Award,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Cloud,
  Download,
  GraduationCap,
  Loader2,
  LogOut,
  MoreHorizontal,
  NotebookText,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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

import { ThemeToggle } from "@/components/layout/theme-toggle";
import { ReminderBell } from "@/components/layout/ReminderBell";
import { SemesterFormDialog } from "@/components/semesters/SemesterFormDialog";
import { SubjectFormDialog } from "@/components/subjects/SubjectFormDialog";
import { downloadJsonBackup, importJsonBackup, useAppStore } from "@/lib/store";
import { logout, useAuthStatus } from "@/lib/auth";
import { useSyncStatus } from "@/lib/cloud-sync";
import { cn } from "@/lib/utils";
import type { Semester, Subject } from "@/types";
import type { Nezet } from "@/components/layout/AppShell";

const SYNC_STATUS_META = {
  idle: { icon: Cloud, label: "Szinkronizálva", className: "text-muted-foreground" },
  syncing: { icon: Loader2, label: "Mentés…", className: "text-muted-foreground animate-pulse" },
  synced: { icon: Cloud, label: "Szinkronizálva", className: "text-emerald-600 dark:text-emerald-400" },
  error: { icon: AlertCircle, label: "Szinkronizációs hiba", className: "text-destructive" },
} as const;

interface SidebarProps {
  nezet: Nezet;
  onNavigate: (nezet: Nezet) => void;
  /** A gyors keresés / parancspaletta (Ctrl+K) megnyitása. */
  onOpenCommandPalette: () => void;
}

export function Sidebar({ nezet, onNavigate, onOpenCommandPalette }: SidebarProps) {
  const semesters = useAppStore((s) => s.semesters);
  const subjects = useAppStore((s) => s.subjects);
  const setActiveSemester = useAppStore((s) => s.setActiveSemester);
  const deleteSemester = useAppStore((s) => s.deleteSemester);
  const toggleSemesterArchived = useAppStore((s) => s.toggleSemesterArchived);

  const { user } = useAuthStatus();
  const syncStatus = useSyncStatus();
  const syncMeta = SYNC_STATUS_META[syncStatus];
  const SyncIcon = syncMeta.icon;

  async function handleLogout() {
    try {
      await logout();
    } catch {
      toast.error("A kijelentkezés nem sikerült. Próbáld újra.");
    }
  }

  const aktivFelev = useMemo(
    () => semesters.find((s) => s.aktiv) ?? semesters[0],
    [semesters]
  );
  const aktivTargyak = useMemo(
    () => subjects.filter((sub) => sub.semesterId === aktivFelev?.id),
    [subjects, aktivFelev]
  );

  // A lezárt féléveket nem töröljük, csak alapból összecsukva, egy külön
  // "Archívum" csoportban jelenítjük meg, hogy a friss félévek maradjanak
  // fókuszban — a bennük lévő tárgyak/jegyek továbbra is beleszámítanak a
  // Kreditindexbe.
  const nyitottFelevek = useMemo(
    () => semesters.filter((s) => !s.archivalt),
    [semesters]
  );
  const archivaltFelevek = useMemo(
    () => semesters.filter((s) => s.archivalt),
    [semesters]
  );
  const [archivumNyitva, setArchivumNyitva] = useState(false);

  const [semesterDialogOpen, setSemesterDialogOpen] = useState(false);
  const [editingSemester, setEditingSemester] = useState<Semester | undefined>();
  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Semester | undefined>();
  // A félév "..." menüjének kontrollált nyitva-tartása — enélkül a
  // Szerkesztés/Törlés menüpont (onSelect + preventDefault, hogy elkerüljük
  // a dialógus-nyitás Radix fókusz-versenyhelyzetét) nyitva hagyná a menüt,
  // ami a mögötte megnyíló dialógus bezárása után újra megjelenne.
  const [openSemesterMenuId, setOpenSemesterMenuId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const result = await importJsonBackup(file);
    if (result.success) {
      toast.success("Adatok sikeresen importálva");
      onNavigate({ tipus: "otthon" });
    } else {
      toast.error(result.error ?? "Az importálás sikertelen volt.");
    }
  }

  function handleDeleteSemester() {
    if (!deleteTarget) return;
    deleteSemester(deleteTarget.id);
    toast.success(`„${deleteTarget.nev}” és a hozzá tartozó tárgyak, jegyzetek törölve`);
    setDeleteTarget(undefined);
    onNavigate({ tipus: "otthon" });
  }

  function handleToggleArchive(sem: Semester) {
    toggleSemesterArchived(sem.id);
    toast.success(
      sem.archivalt ? `„${sem.nev}” visszaállítva az archívumból` : `„${sem.nev}” archiválva`
    );
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r bg-muted/20">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <GraduationCap className="h-4 w-4" />
        </div>
        <button
          onClick={() => onNavigate({ tipus: "otthon" })}
          className="text-sm font-semibold hover:opacity-80"
        >
          Egyetemi Jegyzetek
        </button>
      </div>

      <div className="px-3 pb-3">
        <button
          onClick={onOpenCommandPalette}
          className="flex w-full items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">Gyors keresés…</span>
          <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">
            Ctrl K
          </kbd>
        </button>
      </div>

      <div className="space-y-0.5 px-3">
        <button
          onClick={() => onNavigate({ tipus: "osszes-jegyzet" })}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
            nezet.tipus === "osszes-jegyzet"
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:bg-muted"
          )}
        >
          <NotebookText className="h-4 w-4" />
          Összes jegyzetem
        </button>
        <button
          onClick={() => onNavigate({ tipus: "naptar" })}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
            nezet.tipus === "naptar"
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:bg-muted"
          )}
        >
          <CalendarDays className="h-4 w-4" />
          Naptár
        </button>
        <button
          onClick={() => onNavigate({ tipus: "kreditindex" })}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
            nezet.tipus === "kreditindex"
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:bg-muted"
          )}
        >
          <Award className="h-4 w-4" />
          Kreditindex
        </button>
      </div>

      <div className="mx-3 my-3 border-t" />

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <div className="mb-1.5 flex items-center justify-between px-1">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Félévek
          </span>
          <button
            onClick={() => {
              setEditingSemester(undefined);
              setSemesterDialogOpen(true);
            }}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Új félév"
            title="Új félév"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {semesters.length === 0 && (
          <p className="px-1 py-2 text-xs text-muted-foreground">
            Még nincs féléved — hozz létre egyet a fenti „+” gombbal.
          </p>
        )}

        {semesters.length > 0 && nyitottFelevek.length === 0 && (
          <p className="px-1 py-2 text-xs text-muted-foreground">
            Nincs aktív féléved — minden félév archiválva van, lásd alul.
          </p>
        )}

        <div className="space-y-0.5">
          {nyitottFelevek.map((sem) => (
            <SemesterRow
              key={sem.id}
              sem={sem}
              isActive={sem.id === aktivFelev?.id}
              aktivTargyak={aktivTargyak}
              nezet={nezet}
              openSemesterMenuId={openSemesterMenuId}
              setOpenSemesterMenuId={setOpenSemesterMenuId}
              onSelect={() => setActiveSemester(sem.id)}
              onNavigate={onNavigate}
              onNewSubject={() => setSubjectDialogOpen(true)}
              onEdit={() => {
                setEditingSemester(sem);
                setSemesterDialogOpen(true);
              }}
              onToggleArchive={() => handleToggleArchive(sem)}
              onDelete={() => setDeleteTarget(sem)}
            />
          ))}
        </div>

        {archivaltFelevek.length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setArchivumNyitva((v) => !v)}
              aria-expanded={archivumNyitva}
              className="flex w-full items-center gap-1 rounded-md px-1 py-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase hover:text-foreground"
            >
              {archivumNyitva ? (
                <ChevronDown className="h-3 w-3" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-3 w-3" aria-hidden="true" />
              )}
              Archívum ({archivaltFelevek.length})
            </button>

            {archivumNyitva && (
              <div className="mt-0.5 space-y-0.5 opacity-70">
                {archivaltFelevek.map((sem) => (
                  <SemesterRow
                    key={sem.id}
                    sem={sem}
                    isActive={sem.id === aktivFelev?.id}
                    aktivTargyak={aktivTargyak}
                    nezet={nezet}
                    openSemesterMenuId={openSemesterMenuId}
                    setOpenSemesterMenuId={setOpenSemesterMenuId}
                    onSelect={() => setActiveSemester(sem.id)}
                    onNavigate={onNavigate}
                    onNewSubject={() => setSubjectDialogOpen(true)}
                    onEdit={() => {
                      setEditingSemester(sem);
                      setSemesterDialogOpen(true);
                    }}
                    onToggleArchive={() => handleToggleArchive(sem)}
                    onDelete={() => setDeleteTarget(sem)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t px-3 py-2">
        <div
          className={cn("flex items-center gap-1.5 text-xs", syncMeta.className)}
          title={syncMeta.label}
        >
          <SyncIcon className={cn("h-3.5 w-3.5", syncStatus === "syncing" && "animate-spin")} />
          <span className="hidden truncate sm:inline">{syncMeta.label}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground"
          onClick={handleLogout}
          title={user?.email ? `Kijelentkezés (${user.email})` : "Kijelentkezés"}
          aria-label="Kijelentkezés"
        >
          <LogOut className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex items-center justify-between border-t px-3 py-2.5">
        <div className="flex items-center gap-0.5">
          <ThemeToggle />
          <ReminderBell />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => fileInputRef.current?.click()}
            title="Adatok importálása"
            aria-label="Adatok importálása"
          >
            <Upload className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              downloadJsonBackup();
              toast.success("Biztonsági mentés letöltve");
            }}
            title="Biztonsági mentés"
            aria-label="Biztonsági mentés"
          >
            <Download className="h-4 w-4" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleFileSelected}
          />
        </div>
      </div>

      <SemesterFormDialog
        open={semesterDialogOpen}
        onOpenChange={setSemesterDialogOpen}
        semester={editingSemester}
      />

      {aktivFelev && (
        <SubjectFormDialog
          open={subjectDialogOpen}
          onOpenChange={setSubjectDialogOpen}
          semesterId={aktivFelev.id}
          onSaved={(subjectId) => onNavigate({ tipus: "targy", subjectId })}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Biztosan törlöd ezt a félévet?</AlertDialogTitle>
            <AlertDialogDescription>
              „{deleteTarget?.nev}” törlésével az összes hozzá tartozó tárgy és
              jegyzet is véglegesen törlődik. Ez a művelet nem vonható vissza.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Mégse</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDeleteSemester}
            >
              Törlés
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}

// ============================================================================
// Egy félév sora az oldalsávban — közös komponens a nyitott és az
// archivált félévek listájához, hogy a két hely ne térhessen el egymástól.
// ============================================================================
interface SemesterRowProps {
  sem: Semester;
  isActive: boolean;
  aktivTargyak: Subject[];
  nezet: Nezet;
  openSemesterMenuId: string | null;
  setOpenSemesterMenuId: (id: string | null) => void;
  onSelect: () => void;
  onNavigate: (nezet: Nezet) => void;
  onNewSubject: () => void;
  onEdit: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}

function SemesterRow({
  sem,
  isActive,
  aktivTargyak,
  nezet,
  openSemesterMenuId,
  setOpenSemesterMenuId,
  onSelect,
  onNavigate,
  onNewSubject,
  onEdit,
  onToggleArchive,
  onDelete,
}: SemesterRowProps) {
  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 rounded-md pr-1 pl-2.5 text-sm",
          isActive && "bg-muted font-medium"
        )}
      >
        <button onClick={onSelect} className="flex-1 truncate py-1.5 text-left">
          {sem.nev}
        </button>
        <DropdownMenu
          open={openSemesterMenuId === sem.id}
          onOpenChange={(v) => setOpenSemesterMenuId(v ? sem.id : null)}
        >
          <DropdownMenuTrigger asChild>
            <button
              className="rounded p-1 text-muted-foreground opacity-0 hover:bg-background group-hover:opacity-100 focus:opacity-100"
              aria-label="Félév műveletek"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setOpenSemesterMenuId(null);
                onEdit();
              }}
            >
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Szerkesztés
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setOpenSemesterMenuId(null);
                onToggleArchive();
              }}
            >
              {sem.archivalt ? (
                <>
                  <ArchiveRestore className="mr-2 h-3.5 w-3.5" />
                  Visszaállítás
                </>
              ) : (
                <>
                  <Archive className="mr-2 h-3.5 w-3.5" />
                  Archiválás
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={(e) => {
                e.preventDefault();
                setOpenSemesterMenuId(null);
                onDelete();
              }}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Törlés
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isActive && (
        <div className="mt-0.5 mb-1 ml-3 space-y-0.5 border-l pl-2.5">
          {aktivTargyak.map((sub) => {
            const subActive = nezet.tipus === "targy" && nezet.subjectId === sub.id;
            return (
              <button
                key={sub.id}
                onClick={() => onNavigate({ tipus: "targy", subjectId: sub.id })}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                  subActive
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: sub.szin }}
                />
                <span className="truncate">{sub.nev}</span>
              </button>
            );
          })}
          <button
            onClick={onNewSubject}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" />
            Új tárgy
          </button>
        </div>
      )}
    </div>
  );
}
