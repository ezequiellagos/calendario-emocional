import { DEFAULT_LOCAL_USER_ID, getDb, getSqlite, initializeDatabase } from '@/db/client';
import { getMongoDatabase, isMongoConfigured } from '@/db/mongo-client';
import {
  getLatestFieldTimestamp,
  getPendingOperationsCount,
  getSyncDiagnostics as readSyncDiagnostics,
  hasRecordedOperation,
  listPendingLocalOperations,
  markOperationsSynced,
  recordAppliedRemoteOperation,
  setSyncMetric,
} from '@/db/sync-operations';
import { getOrCreateInstanceId, getSyncStateValue, setSyncStateValue } from '@/db/sync-state';
import { isServerEnvEnabled, readServerEnvTrimmed } from '@/lib/server-env';

import type {
  EmotionCentralDocument,
  EntryCentralDocument,
  SyncConfiguration,
  SyncFieldChange,
  SyncOperationPayload,
} from '@/types/system';

type SyncOperationDocument = SyncOperationPayload & { _id: string };
interface SyncExecutionResult {
  pushed: number;
  pulled: number;
  applied: number;
  message: string;
}

const missingEmotionDependencyPrefix = 'MISSING_EMOTION_SYNC_ID:';
export const MANUAL_SYNC_COOLDOWN_MS = 60_000;
const syncTasksByUser = new Map<string, Promise<SyncExecutionResult>>();

export class SyncCooldownError extends Error {
  constructor(public readonly availableAt: string) {
    super(`Debes esperar hasta ${availableAt} antes de volver a sincronizar manualmente.`);
    this.name = 'SyncCooldownError';
  }
}

function getCollectionsNameSuffix() {
  return readServerEnvTrimmed('MONGODB_COLLECTION_PREFIX') ?? 'emotional_calendar';
}

async function getCollections() {
  const database = await getMongoDatabase();
  const prefix = getCollectionsNameSuffix();
  const emotions = database.collection<EmotionCentralDocument>(`${prefix}_emotions`);
  const entries = database.collection<EntryCentralDocument>(`${prefix}_entries`);
  const operations = database.collection<SyncOperationDocument>(`${prefix}_operations`);

  await Promise.all([
    emotions.createIndex({ userId: 1, updatedAt: 1 }),
    entries.createIndex({ userId: 1, updatedAt: 1 }),
    operations.createIndex({ userId: 1, occurredAt: 1, originInstanceId: 1 }),
  ]);

  return { emotions, entries, operations };
}

function getCentralEntityId(userId: string, entityKey: string) {
  return `${userId}:${entityKey}`;
}

function getMaxTimestamp(changes: Record<string, SyncFieldChange>) {
  return Object.values(changes).reduce((latest, change) => change.updatedAt.localeCompare(latest) > 0 ? change.updatedAt : latest, '');
}

function applyChangeMap<T extends { fieldTimestamps: Record<string, string>; updatedAt: string; deletedAt: string | null }>(
  document: T,
  operation: SyncOperationPayload,
) {
  const nextDocument = {
    ...document,
    fieldTimestamps: { ...document.fieldTimestamps },
  };

  for (const [field, change] of Object.entries(operation.changes)) {
    const currentTimestamp = nextDocument.fieldTimestamps[field];
    if (currentTimestamp && currentTimestamp.localeCompare(change.updatedAt) >= 0) {
      continue;
    }

    (nextDocument as Record<string, unknown>)[field] = change.value;
    nextDocument.fieldTimestamps[field] = change.updatedAt;
  }

  nextDocument.updatedAt = getMaxTimestamp(operation.changes) || operation.occurredAt;
  if (operation.kind === 'upsert' && nextDocument.deletedAt && nextDocument.fieldTimestamps.deletedAt && nextDocument.updatedAt.localeCompare(nextDocument.fieldTimestamps.deletedAt) > 0) {
    nextDocument.deletedAt = null;
  }
  return nextDocument;
}

function buildEmptyEmotionDocument(userId: string, syncId: string): EmotionCentralDocument {
  return {
    _id: getCentralEntityId(userId, syncId),
    userId,
    syncId,
    name: '',
    slug: syncId,
    color: '#94a3b8',
    active: true,
    isSystem: false,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    deletedAt: null,
    fieldTimestamps: {},
  };
}

function buildEmptyEntryDocument(userId: string, date: string): EntryCentralDocument {
  return {
    _id: getCentralEntityId(userId, date),
    userId,
    date,
    note: '',
    primaryEmotionSyncId: null,
    primaryColor: null,
    emotionSyncIds: [],
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    deletedAt: null,
    fieldTimestamps: {},
  };
}

function listLocalEmotionsForMongo(userId: string) {
  const rows = getSqlite(userId).prepare(
    `SELECT sync_id as syncId, name, slug, color, active, is_system as isSystem, created_at as createdAt, updated_at as updatedAt
     FROM emotions
     WHERE sync_id IS NOT NULL
     ORDER BY id ASC`,
  ).all() as Array<{
    syncId: string;
    name: string;
    slug: string;
    color: string;
    active: number;
    isSystem: number;
    createdAt: string;
    updatedAt: string;
  }>;

  return rows.map((row) => ({
    syncId: row.syncId,
    name: row.name,
    slug: row.slug,
    color: row.color,
    active: Boolean(row.active),
    isSystem: Boolean(row.isSystem),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

async function ensureEmotionDocumentsInMongo(userId: string) {
  const localEmotions = listLocalEmotionsForMongo(userId);
  if (localEmotions.length === 0) {
    return 0;
  }

  const { emotions } = await getCollections();
  const documentIds = localEmotions.map((emotion) => getCentralEntityId(userId, emotion.syncId));
  const existingDocuments = await emotions.find(
    { _id: { $in: documentIds } },
    { projection: { _id: 1 } },
  ).toArray();
  const existingIds = new Set(existingDocuments.map((document) => document._id));
  const missingEmotions = localEmotions.filter((emotion) => !existingIds.has(getCentralEntityId(userId, emotion.syncId)));

  if (missingEmotions.length === 0) {
    return 0;
  }

  await emotions.insertMany(missingEmotions.map((emotion) => ({
    _id: getCentralEntityId(userId, emotion.syncId),
    userId,
    syncId: emotion.syncId,
    name: emotion.name,
    slug: emotion.slug,
    color: emotion.color,
    active: emotion.active,
    isSystem: emotion.isSystem,
    createdAt: emotion.createdAt,
    updatedAt: emotion.updatedAt,
    deletedAt: null,
    fieldTimestamps: {
      name: emotion.updatedAt,
      slug: emotion.updatedAt,
      color: emotion.updatedAt,
      active: emotion.updatedAt,
      isSystem: emotion.updatedAt,
      createdAt: emotion.createdAt,
    },
  })), { ordered: false });

  return missingEmotions.length;
}

async function applyOperationToMongo(operation: SyncOperationPayload) {
  const { emotions, entries, operations } = await getCollections();
  if (operation.entityType === 'emotion') {
    const current = await emotions.findOne({ _id: getCentralEntityId(operation.userId, operation.entityKey) }) ?? buildEmptyEmotionDocument(operation.userId, operation.entityKey);
    const next = applyChangeMap(current, operation);
    await emotions.replaceOne({ _id: next._id }, next, { upsert: true });
  } else {
    const current = await entries.findOne({ _id: getCentralEntityId(operation.userId, operation.entityKey) }) ?? buildEmptyEntryDocument(operation.userId, operation.entityKey);
    const next = applyChangeMap(current, operation);
    await entries.replaceOne({ _id: next._id }, next, { upsert: true });
  }

  await operations.updateOne({ _id: operation.id }, { $setOnInsert: { ...operation, _id: operation.id } }, { upsert: true });
}

function findLocalEmotionBySyncId(userId: string, syncId: string) {
  const row = getSqlite(userId).prepare(
    'SELECT id, sync_id as syncId, name, slug, color, active, is_system as isSystem, created_at as createdAt, updated_at as updatedAt FROM emotions WHERE sync_id = ?',
  ).get(syncId) as {
    id: number;
    syncId: string;
    name: string;
    slug: string;
    color: string;
    active: number;
    isSystem: number;
    createdAt: string;
    updatedAt: string;
  } | undefined;

  if (!row) {
    return null;
  }

  return {
    ...row,
    active: Boolean(row.active),
    isSystem: Boolean(row.isSystem),
  };
}

function mapEmotionSyncIdsToLocalIds(userId: string, syncIds: string[]) {
  if (syncIds.length === 0) {
    return [] as number[];
  }

  const placeholders = syncIds.map(() => '?').join(', ');
  const rows = getSqlite(userId).prepare(
    `SELECT id, sync_id as syncId FROM emotions WHERE sync_id IN (${placeholders}) ORDER BY id ASC`,
  ).all(...syncIds) as Array<{ id: number; syncId: string }>;
  const mapping = new Map(rows.map((row) => [row.syncId, row.id]));
  return syncIds.map((syncId) => {
    const localId = mapping.get(syncId);
    if (!localId) {
      throw new Error(`${missingEmotionDependencyPrefix}${syncId}`);
    }

    return localId;
  });
}

function isMissingEmotionDependencyError(error: unknown): error is Error {
  return error instanceof Error && error.message.startsWith(missingEmotionDependencyPrefix);
}

function describeMissingEmotionDependencies(errors: Error[]) {
  const missingSyncIds = Array.from(new Set(errors.map((error) => error.message.slice(missingEmotionDependencyPrefix.length)).filter(Boolean)));
  return missingSyncIds.join(', ');
}

function getOperationPriority(operation: SyncOperationPayload) {
  return operation.entityType === 'emotion' ? 0 : 1;
}

function sortRemoteOperations(operations: SyncOperationDocument[]) {
  return [...operations].sort((left, right) =>
    left.occurredAt.localeCompare(right.occurredAt)
    || getOperationPriority(left) - getOperationPriority(right)
    || left.id.localeCompare(right.id)
  );
}

function applyEmotionOperationToSqlite(userId: string, operation: SyncOperationPayload) {
  const sqlite = getSqlite(userId);
  const existing = findLocalEmotionBySyncId(userId, operation.entityKey);

  if (operation.kind === 'delete') {
    const deletedAt = operation.changes.deletedAt?.updatedAt ?? operation.occurredAt;
    if (existing) {
      const usage = sqlite.prepare('SELECT COUNT(*) as total FROM entry_emotions WHERE emotion_id = ?').get(existing.id) as { total: number };
      if (usage.total > 0) {
        sqlite.prepare('UPDATE emotions SET active = 0, updated_at = ? WHERE id = ?').run(deletedAt, existing.id);
      } else {
        sqlite.prepare('DELETE FROM emotions WHERE id = ?').run(existing.id);
      }

      sqlite.prepare(
        `INSERT INTO emotion_deletions (emotion_id, deleted_at) VALUES (?, ?)
         ON CONFLICT(emotion_id) DO UPDATE SET deleted_at = excluded.deleted_at`,
      ).run(existing.id, deletedAt);
    }
    return;
  }

  const nextName = (operation.changes.name?.value as string | undefined) ?? existing?.name ?? '';
  const nextSlug = (operation.changes.slug?.value as string | undefined) ?? existing?.slug ?? operation.entityKey;
  const nextColor = (operation.changes.color?.value as string | undefined) ?? existing?.color ?? '#94a3b8';
  const nextActive = (operation.changes.active?.value as boolean | undefined) ?? existing?.active ?? true;
  const nextIsSystem = (operation.changes.isSystem?.value as boolean | undefined) ?? existing?.isSystem ?? false;
  const nextCreatedAt = (operation.changes.createdAt?.value as string | undefined) ?? existing?.createdAt ?? operation.occurredAt;
  const nextUpdatedAt = getMaxTimestamp(operation.changes) || operation.occurredAt;

  if (existing) {
    sqlite.prepare(
      `UPDATE emotions
       SET name = ?, slug = ?, color = ?, active = ?, is_system = ?, created_at = ?, updated_at = ?
       WHERE id = ?`,
    ).run(nextName, nextSlug, nextColor, nextActive ? 1 : 0, nextIsSystem ? 1 : 0, nextCreatedAt, nextUpdatedAt, existing.id);
  } else {
    sqlite.prepare(
      `INSERT INTO emotions (sync_id, name, slug, color, active, is_system, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(operation.entityKey, nextName, nextSlug, nextColor, nextActive ? 1 : 0, nextIsSystem ? 1 : 0, nextCreatedAt, nextUpdatedAt);
  }

  if (existing?.id) {
    sqlite.prepare('DELETE FROM emotion_deletions WHERE emotion_id = ?').run(existing.id);
  }
}

function applyEntryOperationToSqlite(userId: string, operation: SyncOperationPayload) {
  const sqlite = getSqlite(userId);

  if (operation.kind === 'delete') {
    const deletedAt = operation.changes.deletedAt?.updatedAt ?? operation.occurredAt;
    sqlite.prepare(
      `INSERT INTO entry_deletions (entry_date, deleted_at) VALUES (?, ?)
       ON CONFLICT(entry_date) DO UPDATE SET deleted_at = excluded.deleted_at`,
    ).run(operation.entityKey, deletedAt);
    sqlite.prepare('DELETE FROM entries WHERE date = ?').run(operation.entityKey);
    return;
  }

  const existing = sqlite.prepare(
    'SELECT date, note, primary_emotion_id as primaryEmotionId, primary_color as primaryColor, created_at as createdAt, updated_at as updatedAt FROM entries WHERE date = ?',
  ).get(operation.entityKey) as {
    date: string;
    note: string;
    primaryEmotionId: number | null;
    primaryColor: string | null;
    createdAt: string;
    updatedAt: string;
  } | undefined;

  const emotionSyncIds = (operation.changes.emotionSyncIds?.value as string[] | undefined) ?? (() => {
    const rows = sqlite.prepare(
      `SELECT emotions.sync_id as syncId FROM entry_emotions
       INNER JOIN emotions ON emotions.id = entry_emotions.emotion_id
       WHERE entry_emotions.entry_date = ?
       ORDER BY entry_emotions.position ASC`,
    ).all(operation.entityKey) as Array<{ syncId: string }>;
    return rows.map((row) => row.syncId);
  })();
  const localEmotionIds = mapEmotionSyncIdsToLocalIds(userId, emotionSyncIds);
  const primaryEmotionSyncId = (operation.changes.primaryEmotionSyncId?.value as string | null | undefined) ?? null;
  const primaryEmotionId = primaryEmotionSyncId ? mapEmotionSyncIdsToLocalIds(userId, [primaryEmotionSyncId])[0] ?? null : null;
  const nextNote = (operation.changes.note?.value as string | undefined) ?? existing?.note ?? '';
  const nextPrimaryColor = (operation.changes.primaryColor?.value as string | null | undefined) ?? existing?.primaryColor ?? null;
  const nextCreatedAt = (operation.changes.createdAt?.value as string | undefined) ?? existing?.createdAt ?? operation.occurredAt;
  const nextUpdatedAt = getMaxTimestamp(operation.changes) || operation.occurredAt;

  if (existing) {
    sqlite.prepare(
      `UPDATE entries SET note = ?, primary_emotion_id = ?, primary_color = ?, created_at = ?, updated_at = ? WHERE date = ?`,
    ).run(nextNote, primaryEmotionId, nextPrimaryColor, nextCreatedAt, nextUpdatedAt, operation.entityKey);
    sqlite.prepare('DELETE FROM entry_emotions WHERE entry_date = ?').run(operation.entityKey);
  } else {
    sqlite.prepare(
      `INSERT INTO entries (date, note, primary_emotion_id, primary_color, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(operation.entityKey, nextNote, primaryEmotionId, nextPrimaryColor, nextCreatedAt, nextUpdatedAt);
  }

  const insertRelation = sqlite.prepare('INSERT INTO entry_emotions (entry_date, emotion_id, position) VALUES (?, ?, ?)');
  localEmotionIds.forEach((emotionId, index) => {
    insertRelation.run(operation.entityKey, emotionId, index);
  });
  sqlite.prepare('DELETE FROM entry_deletions WHERE entry_date = ?').run(operation.entityKey);
}

function applyRemoteOperationToSqlite(userId: string, operation: SyncOperationPayload) {
  const applicableChanges = Object.fromEntries(
    Object.entries(operation.changes).filter(([field, change]) => {
      const localTimestamp = getLatestFieldTimestamp(getDb(userId), operation.entityType, operation.entityKey, field);
      return !localTimestamp || change.updatedAt.localeCompare(localTimestamp) > 0;
    }),
  );

  const nextOperation = {
    ...operation,
    changes: applicableChanges,
  } satisfies SyncOperationPayload;

  if (Object.keys(nextOperation.changes).length > 0) {
    if (nextOperation.entityType === 'emotion') {
      applyEmotionOperationToSqlite(userId, nextOperation);
    } else {
      applyEntryOperationToSqlite(userId, nextOperation);
    }
  }

  recordAppliedRemoteOperation(getDb(userId), operation);
}

export function getSyncConfiguration(): SyncConfiguration {
  return {
    enabled: isMongoConfigured(),
    provider: isMongoConfigured() ? 'mongo' : 'none',
  };
}

export function getSyncDiagnostics(userId = DEFAULT_LOCAL_USER_ID) {
  initializeDatabase(userId);
  return readSyncDiagnostics(getDb(userId), isMongoConfigured());
}

function buildSyncMessage(pushResult: { pushed: number }, pullResult: { pulled: number; applied: number }) {
  if (pushResult.pushed === 0 && pullResult.pulled === 0) {
    return 'No habia cambios pendientes para sincronizar.';
  }

  return `Sincronizacion completada. Enviados: ${pushResult.pushed}. Traidos: ${pullResult.pulled}. Aplicados: ${pullResult.applied}.`;
}

function getManualSyncAvailableAt(db: ReturnType<typeof getDb>) {
  return getSyncStateValue(db, 'mongo-manual-sync-available-at');
}

function setManualSyncCooldown(db: ReturnType<typeof getDb>) {
  const availableAt = new Date(Date.now() + MANUAL_SYNC_COOLDOWN_MS).toISOString();
  setSyncMetric(db, 'mongo-manual-sync-available-at', availableAt);
  setSyncMetric(db, 'mongo-last-manual-sync-at', new Date().toISOString());
  return availableAt;
}

async function executeUnifiedSync(userId: string): Promise<SyncExecutionResult> {
  const existingTask = syncTasksByUser.get(userId);
  if (existingTask) {
    return existingTask;
  }

  const task = (async () => {
    const pushResult = await pushLocalChangesToMongo(userId);
    const pullResult = await pullChangesFromMongo(userId);

    return {
      pushed: pushResult.pushed,
      pulled: pullResult.pulled,
      applied: pullResult.applied,
      message: buildSyncMessage(pushResult, pullResult),
    };
  })();

  syncTasksByUser.set(userId, task);

  try {
    return await task;
  } finally {
    syncTasksByUser.delete(userId);
  }
}

export async function runManualSync(userId = DEFAULT_LOCAL_USER_ID) {
  initializeDatabase(userId);
  const db = getDb(userId);
  const availableAt = getManualSyncAvailableAt(db);
  const now = new Date().toISOString();

  if (availableAt && availableAt.localeCompare(now) > 0) {
    throw new SyncCooldownError(availableAt);
  }

  const result = await executeUnifiedSync(userId);
  setManualSyncCooldown(db);
  return result;
}

export async function runAutomaticSync(userId = DEFAULT_LOCAL_USER_ID) {
  initializeDatabase(userId);
  return executeUnifiedSync(userId);
}

export async function pushLocalChangesToMongo(userId = DEFAULT_LOCAL_USER_ID) {
  initializeDatabase(userId);
  const db = getDb(userId);
  if (!isMongoConfigured()) {
    return { pushed: 0 };
  }

  await ensureEmotionDocumentsInMongo(userId);

  const operations = listPendingLocalOperations(db);
  if (operations.length === 0) {
    setSyncMetric(db, 'mongo-last-error', '');
    return { pushed: 0 };
  }

  try {
    for (const operation of operations) {
      await applyOperationToMongo(operation);
    }

    const syncedAt = new Date().toISOString();
    markOperationsSynced(db, operations.map((operation) => operation.id), syncedAt);
    setSyncStateValue(db, 'mongo-push-cursor', operations.at(-1)?.occurredAt ?? syncedAt);
    setSyncMetric(db, 'mongo-last-push-at', syncedAt);
    setSyncMetric(db, 'mongo-last-pushed-operations', String(operations.length));
    setSyncMetric(db, 'mongo-last-error', '');
    return { pushed: operations.length };
  } catch (error) {
    setSyncMetric(db, 'mongo-last-error', error instanceof Error ? error.message : 'No se pudieron enviar cambios a Mongo.');
    throw error;
  }
}

export async function pullChangesFromMongo(userId = DEFAULT_LOCAL_USER_ID) {
  initializeDatabase(userId);
  const db = getDb(userId);
  if (!isMongoConfigured()) {
    return { pulled: 0, applied: 0 };
  }

  if (getPendingOperationsCount(db) > 0) {
    throw new Error('Hay cambios locales pendientes. Envia primero la cola local hacia Mongo.');
  }

  try {
    const cursor = getSyncStateValue(db, 'mongo-pull-cursor');
    const instanceId = getOrCreateInstanceId(db);
    const { operations } = await getCollections();
    const remoteOperations = sortRemoteOperations(await operations.find({
      userId,
      originInstanceId: { $ne: instanceId },
      ...(cursor ? { occurredAt: { $gt: cursor } } : {}),
    }).toArray());

    let appliedOperations = 0;
    let pendingOperations = remoteOperations.filter((operation) => !hasRecordedOperation(db, operation.id));

    while (pendingOperations.length > 0) {
      const nextPendingOperations: SyncOperationDocument[] = [];
      const dependencyErrors: Error[] = [];
      let progressed = false;

      for (const operation of pendingOperations) {
        try {
          applyRemoteOperationToSqlite(userId, operation);
          appliedOperations += 1;
          progressed = true;
        } catch (error) {
          if (isMissingEmotionDependencyError(error)) {
            dependencyErrors.push(error);
            nextPendingOperations.push(operation);
            continue;
          }

          throw error;
        }
      }

      if (!progressed && nextPendingOperations.length > 0) {
        const missingDependencies = describeMissingEmotionDependencies(dependencyErrors);
        throw new Error(
          missingDependencies
            ? `No se pudieron aplicar operaciones remotas porque faltan emociones locales requeridas: ${missingDependencies}.`
            : 'No se pudieron aplicar operaciones remotas por dependencias faltantes.',
        );
      }

      pendingOperations = nextPendingOperations;
    }

    const now = new Date().toISOString();
    if (remoteOperations.length > 0) {
      setSyncStateValue(db, 'mongo-pull-cursor', remoteOperations.at(-1)?.occurredAt ?? now);
    }
    setSyncMetric(db, 'mongo-last-pull-at', now);
    setSyncMetric(db, 'mongo-last-pulled-operations', String(remoteOperations.length));
    setSyncMetric(db, 'mongo-last-applied-operations', String(appliedOperations));
    setSyncMetric(db, 'mongo-last-error', '');
    return { pulled: remoteOperations.length, applied: appliedOperations };
  } catch (error) {
    setSyncMetric(db, 'mongo-last-error', error instanceof Error ? error.message : 'No se pudieron descargar cambios desde Mongo.');
    throw error;
  }
}

export async function syncLocalChangeToMongo(userId = DEFAULT_LOCAL_USER_ID) {
  if (!isMongoConfigured() || isServerEnvEnabled('DISABLE_AUTO_MONGO_SYNC')) {
    return;
  }

  try {
    await pushLocalChangesToMongo(userId);
  } catch {
    // La escritura local ya se hizo; la cola queda pendiente para el siguiente intento.
  }
}