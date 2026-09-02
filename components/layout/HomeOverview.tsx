"use client";

import { useMemo, type ElementType } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Clock,
  FileText,
  GraduationCap,
  ListChecks,
  Sparkles,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAppStore } from "@/lib/store";
import { attendanceStatus, calcPercentage, cn, formatDateHu } from "@/lib/utils";
import { buildCalendarItems, todayDateKey } from "@/lib/calendar-helpers";
import { formatGradeToSuffix, summarizePontozas } from "@/lib/pontozas";
import { SUBJECT_ICONS } from "@/lib/subject-icons";
import type { Nezet } from "@/components/layout/AppShell";

export function HomeOverview({ onNavigate }: { onNavigate: (n: Nezet) => void }) {
  const semesters = useAppStore((s) => s.semesters);
  const subjects = useAppStore((s) => s.subjects);
  const notes = useAppStore((s) => s.notes);
  const scheduleEvents = useAppStore((s) => s.scheduleEvents);

  const aktivFelev = useMemo(
    () => semesters.find((s) => s.aktiv) ?? semesters[0],
    [semesters]
  );
  const aktivTargyak = useMemo(
    () => subjects.filter((sub) => sub.semesterId === aktivFelev?.id),
    [subjects, aktivFelev]
  );
  const aktivTargyIds = useMemo(
    () => new Set(aktivTargyak.map((s) => s.id)),
    [aktivTargyak]
  );
  const aktivJegyzetek = useMemo(
    () => notes.filter((n) => aktivTargyIds.has(n.subjectId)),
    [notes, aktivTargyIds]
  );

  const kozelgoHataridok = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return aktivTargyak
      .flatMap((sub) =>
        sub.kovetelmenyek
          .filter((r) => !r.teljesitve && r.hatarido && r.hatarido >= today)
          .map((r) => ({ ...r, subjectNev: sub.nev, subjectId: sub.id, szin: sub.szin }))
      )
      .sort((a, b) => (a.hatarido! < b.hatarido! ? -1 : 1))
      .slice(0, 5);
  }, [aktivTargyak]);

  const nyitottKovetelmenyek = aktivTargyak.reduce(
    (acc, s) => acc + s.kovetelmenyek.filter((r) => !r.teljesitve).length,
    0
  );

  const maiOrak = useMemo(() => {
    const ma = todayDateKey();
    return buildCalendarItems(scheduleEvents, subjects).filter(
      (item) => item.kind === "ora" && item.dateKey === ma
    );
  }, [scheduleEvents, subjects]);

  const hianyzasFigyelmeztetesek = useMemo(() => {
    return aktivTargyak
      .map((sub) => ({ sub, status: attendanceStatus(sub.hianyzas.jelenlegiHianyzas, sub.hianyzas.maxHianyzas) }))
      .filter(({ status }) => status.variant !== "ok");
  }, [aktivTargyak]);

  const pontozasFokusz = useMemo(() => {
    return aktivTargyak
      .map((sub) => ({ sub, summary: summarizePontozas(sub.kovetelmenyek, sub.pontozas) }))
      .filter((x) => x.summary.nextGrade !== null && x.summary.pointsNeededForNextGrade !== null)
      .sort((a, b) => a.summary.pointsNeededForNextGrade! - b.summary.pointsNeededForNextGrade!)
      .slice(0, 4);
  }, [aktivTargyak]);

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {aktivFelev ? aktivFelev.nev : "Üdv az Egyetemi Jegyzeteknél"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Minden adat helyben, a böngésződben tárolódik.
        </p>
      </div>

      {!aktivFelev ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Hozz létre egy félévet a bal oldali menüben, hogy elkezdhesd a szervezést.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard icon={GraduationCap} label="Aktív tárgyak" value={aktivTargyak.length} />
            <StatCard icon={FileText} label="Jegyzetek ebben a félévben" value={aktivJegyzetek.length} />
            <StatCard icon={ListChecks} label="Nyitott követelmények" value={nyitottKovetelmenyek} />
          </div>

          {/* A tárgyak mindjárt a statisztikák alatt, a lap tetején
              jelennek meg — ez a leggyakrabban keresett rész, nem szabad
              alálegörgetni értük a többi (kevésbé gyakran nézett) widget alá. */}
          <div>
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">Tárgyaid</h2>
            {aktivTargyak.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Még nincs tárgyad ebben a félévben — vedd fel a bal oldali menüben.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
                {aktivTargyak.map((sub) => {
                  const Icon = SUBJECT_ICONS[sub.ikon] ?? SUBJECT_ICONS.BookOpen;
                  return (
                    <Card
                      key={sub.id}
                      className="cursor-pointer border shadow-none transition-colors hover:bg-muted/40"
                      onClick={() => onNavigate({ tipus: "targy", subjectId: sub.id })}
                    >
                      <CardContent className="flex items-center gap-2.5 p-3">
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
                          style={{ backgroundColor: sub.szin }}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{sub.nev}</div>
                          <div className="text-xs text-muted-foreground">{sub.kod}</div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Clock className="h-4 w-4" />
              Mai óráid
            </h2>
            {maiOrak.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ma nincs órád a felvett órarended alapján — vagy még nem importáltad a Naptár
                nézetben.
              </p>
            ) : (
              <div className="space-y-1.5">
                {maiOrak.map((item) => (
                  <Card
                    key={item.id}
                    className={cn(
                      "border shadow-none",
                      item.subjectId && "cursor-pointer transition-colors hover:bg-muted/40"
                    )}
                    onClick={
                      item.subjectId
                        ? () => onNavigate({ tipus: "targy", subjectId: item.subjectId! })
                        : undefined
                    }
                  >
                    <CardContent className="flex items-center justify-between p-2.5">
                      <div className="flex items-center gap-3">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: item.szin }}
                        />
                        <div>
                          <div className="text-sm font-medium">{item.cim}</div>
                          {item.subtitle && (
                            <div className="text-xs text-muted-foreground">{item.subtitle}</div>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {item.timeLabel}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {(hianyzasFigyelmeztetesek.length > 0 || pontozasFokusz.length > 0) && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {hianyzasFigyelmeztetesek.length > 0 && (
                <div>
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <AlertTriangle className="h-4 w-4" />
                    Hiányzás-figyelmeztetés
                  </h2>
                  <div className="space-y-1.5">
                    {hianyzasFigyelmeztetesek.map(({ sub, status }) => (
                      <Card
                        key={sub.id}
                        className="cursor-pointer border shadow-none transition-colors hover:bg-muted/40"
                        onClick={() => onNavigate({ tipus: "targy", subjectId: sub.id })}
                      >
                        <CardContent className="space-y-1.5 p-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{sub.nev}</span>
                            <Badge
                              variant={status.variant === "danger" ? "destructive" : "outline"}
                              className="text-xs"
                            >
                              {status.label}
                            </Badge>
                          </div>
                          <Progress
                            value={calcPercentage(sub.hianyzas.jelenlegiHianyzas, sub.hianyzas.maxHianyzas)}
                            className={cn(
                              "h-1.5",
                              status.variant === "danger" && "[&>div]:bg-destructive",
                              status.variant === "warning" && "[&>div]:bg-amber-500"
                            )}
                          />
                          <div className="text-xs text-muted-foreground">
                            {sub.hianyzas.jelenlegiHianyzas} / {sub.hianyzas.maxHianyzas} óra
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {pontozasFokusz.length > 0 && (
                <div>
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Sparkles className="h-4 w-4" />
                    Legközelebbi jegyugrás
                  </h2>
                  <div className="space-y-1.5">
                    {pontozasFokusz.map(({ sub, summary }) => (
                      <Card
                        key={sub.id}
                        className="cursor-pointer border shadow-none transition-colors hover:bg-muted/40"
                        onClick={() => onNavigate({ tipus: "targy", subjectId: sub.id })}
                      >
                        <CardContent className="flex items-center justify-between gap-3 p-2.5">
                          <div>
                            <div className="text-sm font-medium">{sub.nev}</div>
                            <div className="text-xs text-muted-foreground">
                              még <strong className="text-foreground">{summary.pointsNeededForNextGrade} pont</strong>{" "}
                              a(z) {formatGradeToSuffix(summary.nextGrade!)}
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              summary.nextGradeReachable === false &&
                                "border-destructive/40 text-destructive"
                            )}
                          >
                            {summary.nextGradeReachable === false ? "kockázatos" : "elérhető"}
                          </Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CalendarClock className="h-4 w-4" />
              Közelgő határidők
            </h2>
            {kozelgoHataridok.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nincs közelgő, nyitott határidőd — szép munka!
              </p>
            ) : (
              <div className="space-y-1.5">
                {kozelgoHataridok.map((r) => (
                  <Card
                    key={r.id}
                    className="cursor-pointer border shadow-none transition-colors hover:bg-muted/40"
                    onClick={() => onNavigate({ tipus: "targy", subjectId: r.subjectId })}
                  >
                    <CardContent className="flex items-center justify-between p-2.5">
                      <div className="flex items-center gap-3">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: r.szin }}
                        />
                        <div>
                          <div className="text-sm font-medium">{r.nev}</div>
                          <div className="text-xs text-muted-foreground">{r.subjectNev}</div>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {formatDateHu(r.hatarido)}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: ElementType;
  label: string;
  value: number;
}) {
  return (
    <Card className="border shadow-none">
      <CardContent className="flex items-center gap-3 p-3.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-xl leading-none font-semibold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
