"use client";

import { useMemo, useState } from "react";
import { Pencil, Sparkles } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PontozasDialog } from "@/components/subjects/PontozasDialog";
import { formatGrade, formatGradeToSuffix, getPontozas, summarizePontozas } from "@/lib/pontozas";
import { calcPercentage, cn } from "@/lib/utils";
import type { Subject } from "@/types";

const GRADE_COLOR: Record<number, string> = {
  1: "text-destructive border-destructive/40",
  2: "text-amber-600 border-amber-500/40 dark:text-amber-400",
  3: "text-yellow-600 border-yellow-500/40 dark:text-yellow-400",
  4: "text-sky-600 border-sky-500/40 dark:text-sky-400",
  5: "text-emerald-600 border-emerald-500/40 dark:text-emerald-400",
};

export function PontozasCard({ subject }: { subject: Subject }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const pontozas = getPontozas(subject.pontozas);
  const summary = useMemo(
    () => summarizePontozas(subject.kovetelmenyek, subject.pontozas),
    [subject.kovetelmenyek, subject.pontozas]
  );

  const gradeClass = GRADE_COLOR[summary.currentGrade] ?? GRADE_COLOR[1];
  const sortedHatarok = [...pontozas.hatarok].sort((a, b) => a.jegy - b.jegy);

  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <h3 className="text-sm font-medium text-foreground">Pontozás</h3>
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
          <Pencil className="h-3.5 w-3.5" />
          Szerkesztés
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {summary.totalSzerzett} / {pontozas.maxOsszpontszam} pont eddig
            </span>
            <Badge variant="outline" className={cn("font-mono text-xs", gradeClass)}>
              {formatGrade(summary.currentGrade)}
            </Badge>
          </div>
          <Progress
            value={Math.min(100, calcPercentage(summary.totalSzerzett, pontozas.maxOsszpontszam))}
            className="h-2"
          />
        </div>

        {summary.nextGrade !== null && summary.pointsNeededForNextGrade !== null && (
          <div
            className={cn(
              "flex items-start gap-2 rounded-lg border p-2.5 text-xs",
              summary.nextGradeReachable === false
                ? "border-destructive/30 bg-destructive/5 text-destructive"
                : "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
            )}
          >
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              A(z) <strong>{formatGradeToSuffix(summary.nextGrade)}</strong> még{" "}
              <strong>{summary.pointsNeededForNextGrade} pont</strong> kell.{" "}
              {summary.remainingMax > 0 ? (
                <>
                  A hátralévő, még nem osztályozott tételekben legfeljebb{" "}
                  <strong>{summary.remainingMax} pont</strong> szerezhető —{" "}
                  {summary.nextGradeReachable
                    ? "ez alapján még reálisan elérhető."
                    : "ez alapján a jelenlegi tételekkel önmagában már nem reális, pluszpontok nélkül."}
                </>
              ) : summary.hasUnscoredItems ? (
                "a hátralévő tételeknél egyelőre nincs megadva max. pontszám, ezért ez nem becsülhető."
              ) : (
                "az összes beírt tétel már osztályozva van — pluszpont vagy egy új tétel nélkül ez már nem érhető el."
              )}
            </span>
          </div>
        )}

        {summary.nextGrade === null && summary.totalSzerzett > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            A legmagasabb jegyhatárt már elérted a beírt pontok alapján.
          </p>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-2.5 text-xs text-muted-foreground">
          {sortedHatarok.map((h) => (
            <span key={h.jegy}>
              <span className="font-medium text-foreground">{formatGrade(h.jegy)}</span>: {h.minPont} ponttól
            </span>
          ))}
        </div>

        {pontozas.megjegyzes ? (
          <p className="rounded-lg bg-muted/40 p-2.5 text-xs whitespace-pre-wrap text-foreground/80">
            {pontozas.megjegyzes}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            Nincs megadva megjegyzés a pontszerzésről (pl. pluszpontok) — a Szerkesztéssel
            felveheted.
          </p>
        )}
      </CardContent>

      <PontozasDialog subject={subject} open={dialogOpen} onOpenChange={setDialogOpen} />
    </Card>
  );
}
