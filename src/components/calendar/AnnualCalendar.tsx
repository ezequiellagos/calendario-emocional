import { MessageSquareMore } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { buildEmotionGradient, getContrastColor, toRgba } from '@/utils/colors';
import { WEEKDAY_LABELS } from '@/utils/dates';

import type { CalendarMonth, EntryRecord } from '@/types/entry';

function matchesFilters(entry: EntryRecord | null, filters: number[]) {
  if (!entry || filters.length === 0) {
    return Boolean(entry);
  }

  return entry.emotions.some((emotion) => filters.includes(emotion.id));
}

function buildAriaLabel(date: string, entry: EntryRecord | null) {
  if (!entry) {
    return `${date}, sin registro`;
  }

  const emotions = entry.emotions.map((emotion) => emotion.name).join(', ');
  const note = entry.note ? ` Nota: ${entry.note}` : '';
  return `${date}, emociones: ${emotions}.${note}`;
}

interface AnnualCalendarProps {
  months: CalendarMonth[];
  filters: number[];
  currentDate?: string | null;
  selectedDate?: string | null;
  onSelectDate?: (date: string) => void;
  exportMode?: boolean;
}

export default function AnnualCalendar({
  months,
  filters,
  currentDate = null,
  selectedDate = null,
  onSelectDate,
  exportMode = false,
}: AnnualCalendarProps) {
  return (
    <div className={cn('grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3', exportMode && 'grid-cols-4 gap-3 md:grid-cols-4 2xl:grid-cols-4')}>
      {months.map((month) => {
        const isCurrentMonth = !exportMode && currentDate?.slice(5, 7) === String(month.month + 1).padStart(2, '0');

        return (
        <Card
          key={month.month}
          className={cn(
            'overflow-hidden rounded-[1.75rem] bg-white/75 transition-colors',
            exportMode && 'rounded-[1.1rem] border-[#ead8ca] bg-white/88 shadow-none',
            isCurrentMonth ? 'border-primary/45 bg-primary/[0.07] shadow-[0_18px_50px_rgba(143,93,61,0.14)]' : '',
          )}
        >
          <CardHeader className={cn('pb-3', exportMode && 'px-3 pb-2 pt-3')}>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className={cn('capitalize', exportMode && 'text-base leading-none')}>{month.label}</CardTitle>
              <div className="flex items-center gap-2">
                {isCurrentMonth ? (
                  <Badge className="bg-primary/12 text-primary">Mes actual</Badge>
                ) : null}
                <Badge variant="outline" className={cn(exportMode && 'px-2 py-0.5 text-[10px]')}>
                  {month.weeks.flat().filter(Boolean).length} días
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className={cn('space-y-3', exportMode && 'space-y-2 px-3 pb-3')}>
            <div className={cn('grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground', exportMode && 'gap-0.5 text-[9px] tracking-[0.12em]')}>
              {WEEKDAY_LABELS.map((weekday) => (
                <span key={weekday}>{weekday}</span>
              ))}
            </div>

            <div className={cn('space-y-1.5', exportMode && 'space-y-1')}>
              {month.weeks.map((week, index) => (
                <div key={`${month.month}-${index}`} className={cn('grid grid-cols-7 gap-1.5', exportMode && 'gap-1')}>
                  {week.map((day, dayIndex) => {
                    if (!day) {
                      return <div key={`${month.month}-${index}-${dayIndex}`} className="aspect-square" />;
                    }

                    const visible = matchesFilters(day.entry, filters);
                    const isToday = !exportMode && currentDate === day.date;
                    const isSelected = !exportMode && selectedDate === day.date;
                    const color = day.entry?.primaryColor ?? '#e5ddd3';
                    const colors = day.entry?.emotions.map((emotion) => emotion.color) ?? [];
                    const style = day.entry
                      ? {
                          backgroundColor: visible ? color : toRgba(color, 0.18),
                          backgroundImage: buildEmotionGradient(colors, visible ? 1 : 0.24),
                          color: visible ? getContrastColor(color) : '#7d6f63',
                          borderColor: visible ? toRgba(color, 0.9) : '#d6cbc0',
                        }
                      : undefined;

                    const sharedClassName = cn(
                      'relative aspect-square rounded-full border text-xs transition duration-150',
                      exportMode && 'text-[10px]',
                      day.entry
                        ? visible
                          ? 'shadow-sm'
                          : 'opacity-75'
                        : 'border-dashed border-border bg-white/50 text-muted-foreground',
                      isToday && 'ring-2 ring-primary ring-offset-2 ring-offset-background shadow-[0_0_0_4px_rgba(143,93,61,0.10)]',
                      isSelected && 'scale-[1.04] ring-2 ring-foreground/40 ring-offset-2 ring-offset-background',
                      !exportMode && 'hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    );

                    const inner = (
                      <>
                        <span className={cn(
                          'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[58%] font-semibold',
                          exportMode && 'text-[10px]',
                          isToday && !day.entry && 'text-primary',
                        )}>
                          {day.day}
                        </span>
                        {isToday ? (
                          <span className="absolute right-1 top-1 size-1.5 rounded-full bg-primary" aria-hidden="true" />
                        ) : null}
                        {day.entry?.note ? (
                          <MessageSquareMore className={cn('absolute bottom-1 left-1/2 size-3 -translate-x-1/2 opacity-75', exportMode && 'bottom-0.5 size-2.5')} />
                        ) : null}
                      </>
                    );

                    if (exportMode || !onSelectDate) {
                      return (
                        <div
                          key={day.date}
                          aria-label={buildAriaLabel(day.date, day.entry)}
                          className={sharedClassName}
                          style={style}
                        >
                          {inner}
                        </div>
                      );
                    }

                    return (
                      <button
                        key={day.date}
                        type="button"
                        aria-label={buildAriaLabel(day.date, day.entry)}
                        className={sharedClassName}
                        style={style}
                        onClick={() => onSelectDate(day.date)}
                      >
                        {inner}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        );
      })}
    </div>
  );
}