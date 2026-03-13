import { getMonthLabel } from '@/utils/dates';

import type { EntryRecord } from '@/types/entry';
import type { MonthlyEmotionMetric, MonthlyStats } from '@/types/stats';

function round(value: number) {
  return Number.parseFloat(value.toFixed(1));
}

function getMonthFromDate(date: string) {
  return Number.parseInt(date.slice(5, 7), 10) - 1;
}

function buildBreakdown(entries: EntryRecord[]): MonthlyEmotionMetric[] {
  const totals = new Map<number, MonthlyEmotionMetric>();

  for (const entry of entries) {
    for (const emotion of entry.emotions) {
      const existing = totals.get(emotion.id);
      if (existing) {
        existing.count += 1;
        continue;
      }

      totals.set(emotion.id, {
        emotion,
        count: 1,
        share: 0,
      });
    }
  }

  const totalMentions = Array.from(totals.values()).reduce((sum, metric) => sum + metric.count, 0);
  return Array.from(totals.values())
    .map((metric) => ({
      ...metric,
      share: totalMentions > 0 ? round((metric.count / totalMentions) * 100) : 0,
    }))
    .sort((left, right) => right.count - left.count || left.emotion.name.localeCompare(right.emotion.name));
}

export function buildMonthlyStatsFromEntries(year: number, entries: EntryRecord[]): MonthlyStats[] {
  let previousRegisteredDays = 0;

  return Array.from({ length: 12 }, (_, month) => {
    const monthEntries = entries.filter((entry) => getMonthFromDate(entry.date) === month);
    const noteDays = monthEntries.filter((entry) => entry.note.trim().length > 0).length;
    const breakdown = buildBreakdown(monthEntries);
    const dominant = breakdown[0] ?? null;
    const registeredDays = monthEntries.length;
    const changeFromPreviousMonth = month === 0 ? null : registeredDays - previousRegisteredDays;
    const trend = changeFromPreviousMonth === null || changeFromPreviousMonth === 0
      ? 'stable'
      : changeFromPreviousMonth > 0
        ? 'up'
        : 'down';
    previousRegisteredDays = registeredDays;

    return {
      month,
      label: getMonthLabel(year, month),
      registeredDays,
      noteDays,
      uniqueEmotionCount: breakdown.length,
      averageEmotionsPerDay: monthEntries.length > 0
        ? round(monthEntries.reduce((sum, entry) => sum + entry.emotions.length, 0) / monthEntries.length)
        : 0,
      dominantEmotion: dominant?.emotion ?? null,
      dominantCount: dominant?.count ?? 0,
      changeFromPreviousMonth,
      trend,
      emotionBreakdown: breakdown.slice(0, 4),
    };
  });
}