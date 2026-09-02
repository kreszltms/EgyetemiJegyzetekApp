"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  Cloud,
  Download,
  GraduationCap,
  Loader2,
  LogOut,
  MoreHorizontal,
  NotebookText,
  Pencil,
  Plus,
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
import { SemesterFormDialog } from "@/components/semesters/SemesterFormDialog";
import { SubjectFormDialog } from "@/components/subjects/SubjectFormDialog";
import { downloadJsonBackup, importJsonBackup, useAppStore } from "@/lib/store";
import { logout, useAuthStatus } from "@/lib/auth";
import { useSyncStatus } from "@/lib/cloud-sync";
import { cn } from "@/lib/utils";
import type { Semester } from "@/types";
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
}

export function Sidebar({ nezet, onNavigate }: SidebarProps) {
  const semesters = useAppStore((s) => s.semesters);
  const subjects = useAppStore((s) => s.subjects);
  const setActiveSemester = useAppStore((s) => s.setActiveSemester);
  const deleteSemester = useAppStore((s) => s.deleteSemester);

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

        <div className="space-y-0.5">
          {semesters.map((sem) => {
            const isActive = sem.id === aktivFelev?.id;
            return (
              <div key={sem.id}>
                <div
                  className={cn(
                    "group flex items-center gap-1 rounded-md pr-1 pl-2.5 text-sm",
                    isActive && "bg-muted font-medium"
                  )}
                >
                  <button
                    onClick={() => setActiveSemester(sem.id)}
                    className="flex-1 truncate py-1.5 text-left"
                  >
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
                          setEditingSemester(sem);
                          setSemesterDialogOpen(true);
                        }}
                      >
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        Szerkesztés
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={(e) => {
                          e.preventDefault();
                          setOpenSemesterMenuId(null);
                          setDeleteTarget(sem);
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
                      const subActive =
                        nezet.tipus === "targy" && nezet.subjectId === sub.id;
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
                      onClick={() => setSubjectDialogOpen(true)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Új tárgy
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
