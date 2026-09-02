"use client";

import { useMemo, useState } from "react";
import { Archive, Award, ChevronDown, ChevronRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { computeKreditIndex, type KreditIndexResult } from "@/lib/kreditindex";
import { formatGrade, GRADE_COLOR_CLASSES } from "@/lib/pontozas";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Nezet } from "@/components/layout/AppShell";
import type { Semester } from "@/types";

export function KreditIndexView({ onNavigate }: { onNavigate: (n: Nezet) => void }) {
  const semesters = useAppStore((s) => s.semesters);
  const subjects = useAppStore((s) => s.subjects);

  const osszesitett = useMemo(() => computeKreditIndex(subjects), [subjects]);

  const felevenkent = useMemo(
    () =>
      semesters.map((sem) => ({
        semester: sem,
        result: computeKreditIndex(subjects.filter((sub) => sub.semesterId === sem.id)),
      })),
    [semesters, subjects]
  );

  // Az archivált (lezárt) félévek a Kreditindexen is alapból összecsukva
  // jelennek meg — az adatuk persze beleszámít az "Összesített kreditindex"-be,
  // csak a részletes bontás nem tolakodik a friss félévek elé.
  const nyitottFelevenkent = useMemo(
    () => felevenkent.filter((f) => !f.semester.archivalt),
    [felevenkent]
  );
  const archivaltFelevenkent = useMemo(
    () => felevenkent.filter((f) => f.semester.archivalt),
    [felevenkent]
  );
  const [archivumNyitva, setArchivumNyitva] = useState(false);

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Award className="h-5 w-5 text-muted-foreground" />
          Kreditindex
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kredit-súlyozott átlag a Pontozás kártyákon eddig beírt pontok alapján becsült
          érdemjegyekből — egy tárgy csak akkor számít bele, ha van megadva kreditértéke és
          legalább egy pont már be van írva nála.
        </p>
      </div>

      {semesters.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Még nincs féléved — hozz létre egyet a bal oldali menüben.
        </div>
      ) : (
        <>
          <Card className="border-none shadow-sm">
            <CardContent className="flex flex-col items-center gap-1.5 p-8 text-center">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Összesített kreditindex
              </span>
              <span className="text-5xl font-semibold tabular-nums">
                {osszesitett.average !== null ? osszesitett.average.toFixed(2) : "—"}
              </span>
              <span className="text-sm text-muted-foreground">
                {osszesitett.totalKredit} kredit alapján · {osszesitett.includedCount} /{" "}
                {osszesitett.totalCount} tárgy számít bele
              </span>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {nyitottFelevenkent.map(({ semester, result }) => (
              <SemesterKreditBlock
                key={semester.id}
                semester={semester}
                result={result}
                onNavigate={onNavigate}
              />
            ))}
          </div>

          {archivaltFelevenkent.length > 0 && (
            <div>
              <button
                onClick={() => setArchivumNyitva((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase hover:text-foreground"
              >
                {archivumNyitva ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                <Archive className="h-3.5 w-3.5" />
                Archivált félévek ({archivaltFelevenkent.length})
              </button>

              {archivumNyitva && (
                <div className="mt-4 space-y-6 opacity-80">
                  {archivaltFelevenkent.map(({ semester, result }) => (
                    <SemesterKreditBlock
                      key={semester.id}
                      semester={semester}
                      result={result}
                      onNavigate={onNavigate}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// Egy félév kártyája a Kreditindex nézeten — közös komponens a nyitott és
// az archivált félévek listájához.
// ============================================================================
function SemesterKreditBlock({
  semester,
  result,
  onNavigate,
}: {
  semester: Semester;
  result: KreditIndexResult;
  onNavigate: (n: Nezet) => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">{semester.nev}</h2>
        <span className="text-sm text-muted-foreground">
          {result.average !== null ? (
            <>
              <strong className="text-foreground">{result.average.toFixed(2)}</strong> ·{" "}
              {result.totalKredit} kredit
            </>
          ) : (
            "még nincs beszámítható tárgy"
          )}
        </span>
      </div>

      {result.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Ebben a félévben még nincs felvett tárgy.
        </p>
      ) : (
        <Card className="border shadow-none">
          <CardContent className="divide-y p-0">
            {result.items.map(({ subject, kredit, hasKredit, grade, included }) => (
              <button
                key={subject.id}
                onClick={() => onNavigate({ tipus: "targy", subjectId: subject.id })}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: subject.szin }}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{subject.nev}</div>
                    <div className="text-xs text-muted-foreground">
                      {hasKredit ? `${kredit} kredit` : "nincs megadva kredit"}
                    </div>
                  </div>
                </div>

                {included && grade !== null ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 font-mono text-xs",
                      GRADE_COLOR_CLASSES[grade] ?? GRADE_COLOR_CLASSES[1]
                    )}
                  >
                    {formatGrade(grade)}
                  </Badge>
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground italic">
                    {!hasKredit ? "nincs kredit" : "nincs pont beírva"}
                  </span>
                )}
              </button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
