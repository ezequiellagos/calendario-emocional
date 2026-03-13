import type { Emotion } from '@/types/emotion';
import type { EntryRecord } from '@/types/entry';
import type { MonthlyStats } from '@/types/stats';
import type { SyncDiagnostics } from '@/types/system';

export interface CalendarInitialData {
  userId: string;
  year: number;
  emotions: Emotion[];
  entries: EntryRecord[];
  syncEnabled: boolean;
  syncDiagnostics: SyncDiagnostics;
}

export interface StatsPageData {
  year: number;
  monthlyStats: MonthlyStats[];
}

export interface StatusPageData {
  syncEnabled: boolean;
  syncDiagnostics: SyncDiagnostics;
}

export interface SettingsPageData {
  userId: string;
  syncEnabled: boolean;
  syncDiagnostics: SyncDiagnostics;
}

export interface ApiErrorPayload {
  error: string;
}

export interface MutationResult {
  message: string;
}