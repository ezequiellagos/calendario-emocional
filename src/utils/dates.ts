import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfYear,
  format,
  getDay,
  parseISO,
  startOfMonth,
  startOfYear,
} from 'date-fns';
import { es } from 'date-fns/locale';

import type { CalendarDay, CalendarMonth, EntryRecord } from '@/types/entry';

export const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export function formatIsoDate(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

export function getMonthLabel(year: number, month: number) {
  return format(new Date(year, month, 1), 'LLLL', { locale: es });
}

export function buildCalendarMonths(year: number, entries: EntryRecord[]): CalendarMonth[] {
  const entryMap = new Map(entries.map((entry) => [entry.date, entry]));

  return Array.from({ length: 12 }, (_, month) => {
    const monthStart = startOfMonth(new Date(year, month, 1));
    const monthEnd = endOfMonth(monthStart);
    const startOffset = (getDay(monthStart) + 6) % 7;
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const cells: Array<CalendarDay | null> = Array.from({ length: startOffset }, () => null);

    for (const day of days) {
      const date = formatIsoDate(day);
      cells.push({
        date,
        day: day.getDate(),
        month,
        isCurrentYear: true,
        entry: entryMap.get(date) ?? null,
      });
    }

    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    const weeks: Array<Array<CalendarDay | null>> = [];
    for (let index = 0; index < cells.length; index += 7) {
      weeks.push(cells.slice(index, index + 7));
    }

    return {
      month,
      label: getMonthLabel(year, month),
      weeks,
    };
  });
}

export function getYearDateRange(year: number) {
  const start = startOfYear(new Date(year, 0, 1));
  const end = endOfYear(new Date(year, 11, 31));
  return {
    start: formatIsoDate(start),
    end: formatIsoDate(end),
  };
}

export function formatLongDate(date: string) {
  return format(parseISO(date), "d 'de' LLLL 'de' yyyy", { locale: es });
}

export function getAdjacentYearDates(year: number) {
  return {
    previousYear: addDays(startOfYear(new Date(year, 0, 1)), -1).getFullYear(),
    nextYear: addDays(endOfYear(new Date(year, 11, 31)), 1).getFullYear(),
  };
}