import { DEFAULT_LOCAL_USER_ID } from '@/db/client';
import { listEntriesByYear } from '@/services/entry-service';
import { buildMonthlyStatsFromEntries } from '@/utils/stats';

export async function getMonthlyStats(year: number, userId = DEFAULT_LOCAL_USER_ID) {
  const entries = await listEntriesByYear(year, userId);
  return buildMonthlyStatsFromEntries(year, entries);
}