import { randomUUID } from 'node:crypto';

import { and, asc, desc, eq, isNull } from 'drizzle-orm';

import { syncOperationsTable } from '@/db/schema';
import { getOrCreateInstanceId, getSyncStateValue, setSyncStateValue } from '@/db/sync-state';

import type { SyncDiagnostics, SyncOperationPayload } from '@/types/system';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

function parsePayload(rawPayload: string) {
  return JSON.parse(rawPayload) as SyncOperationPayload;
}

export function createOperationId() {
  return randomUUID();
}

export function recordLocalOperation(db: BetterSQLite3Database, userId: string, operation: Omit<SyncOperationPayload, 'id' | 'originInstanceId' | 'userId'>) {
  const id = createOperationId();
  const originInstanceId = getOrCreateInstanceId(db);
  const payload: SyncOperationPayload = {
    id,
    userId,
    originInstanceId,
    ...operation,
  };

  db.insert(syncOperationsTable)
    .values({
      id,
      entityType: payload.entityType,
      entityKey: payload.entityKey,
      originInstanceId,
      occurredAt: payload.occurredAt,
      kind: payload.kind,
      payload: JSON.stringify(payload),
      syncedAt: null,
    })
    .run();

  return payload;
}

export function recordAppliedRemoteOperation(db: BetterSQLite3Database, operation: SyncOperationPayload) {
  db.insert(syncOperationsTable)
    .values({
      id: operation.id,
      entityType: operation.entityType,
      entityKey: operation.entityKey,
      originInstanceId: operation.originInstanceId,
      occurredAt: operation.occurredAt,
      kind: operation.kind,
      payload: JSON.stringify(operation),
      syncedAt: operation.occurredAt,
    })
    .onConflictDoNothing()
    .run();
}

export function listPendingLocalOperations(db: BetterSQLite3Database) {
  const instanceId = getOrCreateInstanceId(db);
  return db.select({ payload: syncOperationsTable.payload })
    .from(syncOperationsTable)
    .where(and(eq(syncOperationsTable.originInstanceId, instanceId), isNull(syncOperationsTable.syncedAt)))
    .orderBy(asc(syncOperationsTable.occurredAt))
    .all()
    .map((row) => parsePayload(row.payload));
}

export function markOperationsSynced(db: BetterSQLite3Database, operationIds: string[], syncedAt: string) {
  if (operationIds.length === 0) {
    return;
  }

  for (const operationId of operationIds) {
    db.update(syncOperationsTable)
      .set({ syncedAt })
      .where(eq(syncOperationsTable.id, operationId))
      .run();
  }
}

export function getPendingOperationsCount(db: BetterSQLite3Database) {
  const instanceId = getOrCreateInstanceId(db);
  return db.select({ id: syncOperationsTable.id })
    .from(syncOperationsTable)
    .where(and(eq(syncOperationsTable.originInstanceId, instanceId), isNull(syncOperationsTable.syncedAt)))
    .all().length;
}

export function getLatestFieldTimestamp(db: BetterSQLite3Database, entityType: SyncOperationPayload['entityType'], entityKey: string, fieldName: string) {
  const rows = db.select({ payload: syncOperationsTable.payload })
    .from(syncOperationsTable)
    .where(and(eq(syncOperationsTable.entityType, entityType), eq(syncOperationsTable.entityKey, entityKey)))
    .orderBy(desc(syncOperationsTable.occurredAt))
    .all();

  for (const row of rows) {
    const payload = parsePayload(row.payload);
    const fieldChange = payload.changes[fieldName];
    if (fieldChange) {
      return fieldChange.updatedAt;
    }
  }

  return null;
}

export function setSyncMetric(db: BetterSQLite3Database, key: string, value: string) {
  setSyncStateValue(db, key, value);
}

export function getSyncDiagnostics(db: BetterSQLite3Database, enabled: boolean): SyncDiagnostics {
  return {
    provider: enabled ? 'mongo' : 'none',
    enabled,
    instanceId: getSyncStateValue(db, 'instance-id'),
    manualSyncAvailableAt: getSyncStateValue(db, 'mongo-manual-sync-available-at'),
    pendingOperations: getPendingOperationsCount(db),
    pushCursor: getSyncStateValue(db, 'mongo-push-cursor'),
    pullCursor: getSyncStateValue(db, 'mongo-pull-cursor'),
    lastPushAt: getSyncStateValue(db, 'mongo-last-push-at'),
    lastPullAt: getSyncStateValue(db, 'mongo-last-pull-at'),
    lastPushedOperations: Number.parseInt(getSyncStateValue(db, 'mongo-last-pushed-operations') ?? '0', 10),
    lastPulledOperations: Number.parseInt(getSyncStateValue(db, 'mongo-last-pulled-operations') ?? '0', 10),
    lastAppliedOperations: Number.parseInt(getSyncStateValue(db, 'mongo-last-applied-operations') ?? '0', 10),
    lastError: getSyncStateValue(db, 'mongo-last-error'),
  };
}

export function hasRecordedOperation(db: BetterSQLite3Database, operationId: string) {
  const row = db.select({ id: syncOperationsTable.id }).from(syncOperationsTable).where(eq(syncOperationsTable.id, operationId)).get();
  return Boolean(row);
}