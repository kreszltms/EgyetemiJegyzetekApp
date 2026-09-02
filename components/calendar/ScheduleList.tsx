"use client";

import { useMemo } from "react";
import { Clock } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateKeyHu } from "@/lib/calendar-helpers";
import type { CalendarItem } from "@/lib/calendar-helpers";

interface ScheduleListProps {
  items: CalendarItem[];
  emptyText: string;
}

export function ScheduleList({ items, emptyText }: ScheduleListProps) {
  const groups = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) {
      const list = map.get(item.dateKey);
      if (list) list.push(item);
      else map.set(item.dateKey, [item]);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {groups.map(([dateKey, dayItems]) => (
        <div key={dateKey}>
          <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {formatDateKeyHu(dateKey)}
          </h3>
          <div className="space-y-1.5">
            {dayItems.map((item) => (
              <Card key={item.id} className="border shadow-none">
                <CardContent className="flex items-center gap-3 p-3">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: item.szin }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-medium">{item.cim}</span>
                      {item.kind === "hatarido" && (
                        <Badge
                          variant="outline"
                          className="border-destructive/40 text-[10px] text-destructive"
                        >
                          Határidő
                        </Badge>
                      )}
                    </div>
                    {item.subtitle && (
                      <div className="truncate text-xs text-muted-foreground">
                        {item.subtitle}
                      </div>
                    )}
                  </div>
                  {item.timeLabel && (
                    <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {item.timeLabel}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
