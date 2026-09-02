"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  buildMonthMatrix,
  dateKeyFromDate,
  huMonthYearLabel,
  huWeekdayShort,
  startOfMonth,
  addMonths,
  todayDateKey,
} from "@/lib/calendar-helpers";
import type { CalendarItem } from "@/lib/calendar-helpers";
import { cn } from "@/lib/utils";

const MAX_VISIBLE_PER_DAY = 3;

interface MonthGridProps {
  items: CalendarItem[];
  selectedDateKey: string | null;
  onSelectDay: (dateKey: string) => void;
}

export function MonthGrid({ items, selectedDateKey, onSelectDay }: MonthGridProps) {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));

  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) {
      const list = map.get(item.dateKey);
      if (list) list.push(item);
      else map.set(item.dateKey, [item]);
    }
    return map;
  }, [items]);

  const days = useMemo(() => buildMonthMatrix(viewMonth), [viewMonth]);
  const today = todayDateKey();
  const currentMonthIndex = viewMonth.getMonth();

  return (
    <div className="rounded-xl border">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold capitalize">{huMonthYearLabel(viewMonth)}</h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setViewMonth(startOfMonth(new Date()))}
          >
            Ma
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewMonth((m) => addMonths(m, -1))}
            aria-label="Előző hónap"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewMonth((m) => addMonths(m, 1))}
            aria-label="Következő hónap"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b text-center text-[11px] font-medium text-muted-foreground">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="py-1.5">
            {huWeekdayShort(i)}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dateKey = dateKeyFromDate(day);
          const dayItems = itemsByDay.get(dateKey) ?? [];
          const isCurrentMonth = day.getMonth() === currentMonthIndex;
          const isToday = dateKey === today;
          const isSelected = dateKey === selectedDateKey;

          return (
            <button
              key={dateKey}
              onClick={() => onSelectDay(dateKey)}
              className={cn(
                "flex min-h-20 flex-col items-start gap-0.5 border-b border-r p-1.5 text-left align-top transition-colors last:border-r-0 [&:nth-child(7n)]:border-r-0 hover:bg-muted/40",
                !isCurrentMonth && "bg-muted/20 text-muted-foreground/50",
                isSelected && "bg-primary/10 hover:bg-primary/10"
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[11px]",
                  isToday && "bg-primary font-semibold text-primary-foreground"
                )}
              >
                {day.getDate()}
              </span>
              <div className="flex w-full flex-col gap-0.5">
                {dayItems.slice(0, MAX_VISIBLE_PER_DAY).map((item) => (
                  <span
                    key={item.id}
                    className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] leading-tight"
                    style={{ backgroundColor: `${item.szin}22`, color: item.szin }}
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.szin }}
                    />
                    <span className="truncate">{item.cim}</span>
                  </span>
                ))}
                {dayItems.length > MAX_VISIBLE_PER_DAY && (
                  <span className="px-1 text-[10px] text-muted-foreground">
                    +{dayItems.length - MAX_VISIBLE_PER_DAY} további
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
