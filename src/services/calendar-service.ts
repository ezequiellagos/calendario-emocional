import { DEFAULT_LOCAL_USER_ID } from '@/db/client';
import { listEmotions } from '@/services/emotion-service';
import { listEntriesByYear } from '@/services/entry-service';
import { getSyncConfiguration, getSyncDiagnostics, pullChangesFromMongo } from '@/services/mongo-sync-service';
import { getMonthlyStats } from '@/services/stats-service';

import type { SettingsPageData, StatsPageData, StatusPageData } from '@/types/api';

async function hydrateSyncDiagnostics(userId = DEFAULT_LOCAL_USER_ID) {
  if (getSyncConfiguration().enabled) {
    try {
      await pullChangesFromMongo(userId);
    } catch {
      // Si hay cambios locales pendientes o Mongo no responde, la app sigue sirviendo SQLite local.
    }
  }
}

export async function getCalendarInitialData(year: number, userId = DEFAULT_LOCAL_USER_ID) {
  await hydrateSyncDiagnostics(userId);

  const [emotions, entries] = await Promise.all([
    listEmotions(true, userId),
    listEntriesByYear(year, userId),
  ]);
  return {
    userId,
    year,
    emotions,
    entries,
    syncEnabled: getSyncConfiguration().enabled,
    syncDiagnostics: getSyncDiagnostics(userId),
  };
}

export async function getStatsPageData(year: number, userId = DEFAULT_LOCAL_USER_ID): Promise<StatsPageData> {
  return {
    year,
    monthlyStats: await getMonthlyStats(year, userId),
  };
}

export async function getStatusPageData(userId = DEFAULT_LOCAL_USER_ID): Promise<StatusPageData> {
  await hydrateSyncDiagnostics(userId);

  return {
    syncEnabled: getSyncConfiguration().enabled,
    syncDiagnostics: getSyncDiagnostics(userId),
  };
}

export async function getSettingsPageData(userId = DEFAULT_LOCAL_USER_ID): Promise<SettingsPageData> {
  await hydrateSyncDiagnostics(userId);

  return {
    userId,
    syncEnabled: getSyncConfiguration().enabled,
    syncDiagnostics: getSyncDiagnostics(userId),
  };
}