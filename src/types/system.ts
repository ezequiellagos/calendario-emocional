import type { Emotion } from '@/types/emotion';
import type { EntryRecord } from '@/types/entry';

export interface DatabaseSnapshot {
  exportedAt: string;
  emotions: Emotion[];
  entries: EntryRecord[];
}

export interface SyncConfiguration {
  enabled: boolean;
  provider: 'mongo' | 'remote' | 'none';
}

export interface EntryDeletionRecord {
  date: string;
  deletedAt: string;
}

export interface EmotionDeletionRecord {
  id: number;
  deletedAt: string;
}

export interface SyncChangesPayload {
  generatedAt: string;
  entries: EntryRecord[];
  entryDeletions: EntryDeletionRecord[];
  emotions: Emotion[];
  emotionDeletions: EmotionDeletionRecord[];
}

export interface SyncFieldChange {
  value: boolean | number | string | string[] | null;
  updatedAt: string;
}

export interface SyncOperationPayload {
  id: string;
  userId: string;
  entityType: 'entry' | 'emotion';
  entityKey: string;
  originInstanceId: string;
  occurredAt: string;
  kind: 'upsert' | 'delete';
  changes: Record<string, SyncFieldChange>;
}

export interface EmotionCentralDocument {
  _id: string;
  userId: string;
  syncId: string;
  name: string;
  slug: string;
  color: string;
  active: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  fieldTimestamps: Record<string, string>;
}

export interface EntryCentralDocument {
  _id: string;
  userId: string;
  date: string;
  note: string;
  primaryEmotionSyncId: string | null;
  primaryColor: string | null;
  emotionSyncIds: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  fieldTimestamps: Record<string, string>;
}

export interface SyncDiagnostics {
  userId?: string;
  provider: 'mongo' | 'remote' | 'none';
  enabled: boolean;
  instanceId: string | null;
  manualSyncAvailableAt: string | null;
  pendingOperations: number;
  pushCursor: string | null;
  pullCursor: string | null;
  lastPushAt: string | null;
  lastPullAt: string | null;
  lastPushedOperations: number;
  lastPulledOperations: number;
  lastAppliedOperations: number;
  lastError: string | null;
}