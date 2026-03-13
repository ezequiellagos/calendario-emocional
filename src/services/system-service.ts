import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';

import { closeDatabase, DEFAULT_LOCAL_USER_ID, getDatabasePath, getSqlite, initializeDatabase } from '@/db/client';
import { readServerEnvTrimmed } from '@/lib/server-env';
import { resetRepositories } from '@/repositories';
import { getRepositories } from '@/repositories';

import type {
  DatabaseSnapshot,
  EmotionDeletionRecord,
  EntryDeletionRecord,
  SyncChangesPayload,
  SyncConfiguration,
} from '@/types/system';

function getTemporaryFilePath(prefix: string, extension: string) {
  return path.join(os.tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}.${extension}`);
}

function getSyncConfigurationInternal() {
  const remoteUrl = readServerEnvTrimmed('SYNC_REMOTE_URL');
  const sharedToken = readServerEnvTrimmed('SYNC_SHARED_TOKEN');
  return {
    remoteUrl,
    sharedToken,
    enabled: Boolean(remoteUrl && sharedToken),
  };
}

function getSyncHeaders() {
  const configuration = getSyncConfigurationInternal();
  if (!configuration.enabled || !configuration.sharedToken) {
    throw new Error('La sincronizacion remota no esta configurada en el servidor.');
  }

  return {
    'Content-Type': 'application/json',
    'x-sync-token': configuration.sharedToken,
  };
}

function getSyncSnapshotUrl() {
  const configuration = getSyncConfigurationInternal();
  if (!configuration.enabled || !configuration.remoteUrl) {
    throw new Error('Faltan SYNC_REMOTE_URL o SYNC_SHARED_TOKEN para usar sincronizacion remota.');
  }

  return new URL('/api/system/snapshot', configuration.remoteUrl).toString();
}

function getSyncChangesUrl() {
  const configuration = getSyncConfigurationInternal();
  if (!configuration.enabled || !configuration.remoteUrl) {
    throw new Error('Faltan SYNC_REMOTE_URL o SYNC_SHARED_TOKEN para usar sincronizacion remota.');
  }

  return new URL('/api/system/changes', configuration.remoteUrl).toString();
}

function getCursorKey(kind: 'push' | 'pull') {
  return kind === 'push' ? 'remote-push-cursor' : 'remote-pull-cursor';
}

function readSyncCursor(kind: 'push' | 'pull', userId = DEFAULT_LOCAL_USER_ID) {
  const cursor = getSqlite(userId)
    .prepare('SELECT value FROM sync_state WHERE key = ?')
    .get(getCursorKey(kind)) as { value?: string } | undefined;
  return cursor?.value ?? null;
}

function writeSyncCursor(kind: 'push' | 'pull', value: string, userId = DEFAULT_LOCAL_USER_ID) {
  const now = new Date().toISOString();
  getSqlite(userId).prepare(
    `INSERT INTO sync_state (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(getCursorKey(kind), value, now);
}

function hasSyncChanges(payload: SyncChangesPayload) {
  return payload.entries.length > 0
    || payload.emotions.length > 0
    || payload.entryDeletions.length > 0
    || payload.emotionDeletions.length > 0;
}

function isMoreRecent(left: string, right: string) {
  return left.localeCompare(right) > 0;
}

function listEntryDeletionsSince(since: string | null, userId = DEFAULT_LOCAL_USER_ID): EntryDeletionRecord[] {
  const statement = since
    ? getSqlite(userId).prepare('SELECT entry_date as date, deleted_at as deletedAt FROM entry_deletions WHERE deleted_at > ? ORDER BY deleted_at ASC')
    : getSqlite(userId).prepare('SELECT entry_date as date, deleted_at as deletedAt FROM entry_deletions ORDER BY deleted_at ASC');
  return (since ? statement.all(since) : statement.all()) as EntryDeletionRecord[];
}

function listEmotionDeletionsSince(since: string | null, userId = DEFAULT_LOCAL_USER_ID): EmotionDeletionRecord[] {
  const statement = since
    ? getSqlite(userId).prepare('SELECT emotion_id as id, deleted_at as deletedAt FROM emotion_deletions WHERE deleted_at > ? ORDER BY deleted_at ASC')
    : getSqlite(userId).prepare('SELECT emotion_id as id, deleted_at as deletedAt FROM emotion_deletions ORDER BY deleted_at ASC');
  return (since ? statement.all(since) : statement.all()) as EmotionDeletionRecord[];
}

function getEmotionDeletion(id: number, userId = DEFAULT_LOCAL_USER_ID) {
  return getSqlite(userId).prepare('SELECT deleted_at as deletedAt FROM emotion_deletions WHERE emotion_id = ?').get(id) as { deletedAt?: string } | undefined;
}

function getEntryDeletion(date: string, userId = DEFAULT_LOCAL_USER_ID) {
  return getSqlite(userId).prepare('SELECT deleted_at as deletedAt FROM entry_deletions WHERE entry_date = ?').get(date) as { deletedAt?: string } | undefined;
}

function clearEmotionDeletion(id: number, userId = DEFAULT_LOCAL_USER_ID) {
  getSqlite(userId).prepare('DELETE FROM emotion_deletions WHERE emotion_id = ?').run(id);
}

function clearEntryDeletion(date: string, userId = DEFAULT_LOCAL_USER_ID) {
  getSqlite(userId).prepare('DELETE FROM entry_deletions WHERE entry_date = ?').run(date);
}

function upsertSyncEmotion(emotion: DatabaseSnapshot['emotions'][number], userId = DEFAULT_LOCAL_USER_ID) {
  getSqlite(userId).prepare(
    `INSERT INTO emotions (id, name, slug, color, active, is_system, created_at, updated_at)
     VALUES (@id, @name, @slug, @color, @active, @isSystem, @createdAt, @updatedAt)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       slug = excluded.slug,
       color = excluded.color,
       active = excluded.active,
       is_system = excluded.is_system,
       created_at = excluded.created_at,
       updated_at = excluded.updated_at`,
  ).run({
    id: emotion.id,
    name: emotion.name,
    slug: emotion.slug,
    color: emotion.color,
    active: emotion.active ? 1 : 0,
    isSystem: emotion.isSystem ? 1 : 0,
    createdAt: emotion.createdAt,
    updatedAt: emotion.updatedAt,
  });
}

function upsertSyncEntry(entry: DatabaseSnapshot['entries'][number], userId = DEFAULT_LOCAL_USER_ID) {
  const sqlite = getSqlite(userId);
  sqlite.prepare(
    `INSERT INTO entries (date, note, primary_emotion_id, primary_color, created_at, updated_at)
     VALUES (@date, @note, @primaryEmotionId, @primaryColor, @createdAt, @updatedAt)
     ON CONFLICT(date) DO UPDATE SET
       note = excluded.note,
       primary_emotion_id = excluded.primary_emotion_id,
       primary_color = excluded.primary_color,
       created_at = excluded.created_at,
       updated_at = excluded.updated_at`,
  ).run({
    date: entry.date,
    note: entry.note,
    primaryEmotionId: entry.primaryEmotionId,
    primaryColor: entry.primaryColor,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  });

  sqlite.prepare('DELETE FROM entry_emotions WHERE entry_date = ?').run(entry.date);
  const insertRelation = sqlite.prepare(
    'INSERT INTO entry_emotions (entry_date, emotion_id, position) VALUES (?, ?, ?)',
  );
  entry.emotions.forEach((emotion, index) => {
    insertRelation.run(entry.date, emotion.id, index);
  });
}

function deleteSyncEntry(date: string, deletedAt: string, userId = DEFAULT_LOCAL_USER_ID) {
  getSqlite(userId).prepare(
    `INSERT INTO entry_deletions (entry_date, deleted_at)
     VALUES (?, ?)
     ON CONFLICT(entry_date) DO UPDATE SET deleted_at = excluded.deleted_at`,
  ).run(date, deletedAt);
  getSqlite(userId).prepare('DELETE FROM entries WHERE date = ?').run(date);
}

function deleteSyncEmotion(id: number, deletedAt: string, userId = DEFAULT_LOCAL_USER_ID) {
  const usage = getSqlite(userId).prepare('SELECT COUNT(*) as total FROM entry_emotions WHERE emotion_id = ?').get(id) as { total: number };
  if (usage.total > 0) {
    getSqlite(userId).prepare('UPDATE emotions SET active = 0, updated_at = ? WHERE id = ?').run(deletedAt, id);
    return;
  }

  getSqlite(userId).prepare(
    `INSERT INTO emotion_deletions (emotion_id, deleted_at)
     VALUES (?, ?)
     ON CONFLICT(emotion_id) DO UPDATE SET deleted_at = excluded.deleted_at`,
  ).run(id, deletedAt);
  getSqlite(userId).prepare('DELETE FROM emotions WHERE id = ?').run(id);
}

function ensureUploadIntegrity(uploadPath: string) {
  const validationDb = new Database(uploadPath, { readonly: true });
  try {
    const integrity = validationDb.prepare('PRAGMA integrity_check').pluck().get() as string;
    if (integrity !== 'ok') {
      throw new Error('El archivo SQLite no paso la verificacion de integridad.');
    }
  } finally {
    validationDb.close();
  }
}

function replaceDatabaseFile(uploadPath: string, userId = DEFAULT_LOCAL_USER_ID) {
  const databasePath = getDatabasePath(userId);
  closeDatabase(userId);
  resetRepositories(userId);

  for (const suffix of ['', '-wal', '-shm']) {
    const candidate = `${databasePath}${suffix}`;
    if (fs.existsSync(candidate)) {
      fs.rmSync(candidate, { force: true });
    }
  }

  fs.copyFileSync(uploadPath, databasePath);
  initializeDatabase(userId);
}

export function getSyncConfiguration(): SyncConfiguration {
  const configuration = getSyncConfigurationInternal();
  return {
    enabled: configuration.enabled,
    provider: configuration.enabled ? 'remote' : 'none',
  };
}

export async function exportDatabaseSnapshot(userId = DEFAULT_LOCAL_USER_ID): Promise<DatabaseSnapshot> {
  const { emotionRepository, entryRepository } = getRepositories(userId);
  return {
    exportedAt: new Date().toISOString(),
    emotions: await emotionRepository.listAll(true),
    entries: await entryRepository.listAll(),
  };
}

export function importDatabaseSnapshot(snapshot: DatabaseSnapshot, userId = DEFAULT_LOCAL_USER_ID) {
  const sqlite = getSqlite(userId);
  const transaction = sqlite.transaction((payload: DatabaseSnapshot) => {
    sqlite.prepare('DELETE FROM sync_state').run();
    sqlite.prepare('DELETE FROM emotion_deletions').run();
    sqlite.prepare('DELETE FROM entry_deletions').run();
    sqlite.prepare('DELETE FROM entry_emotions').run();
    sqlite.prepare('DELETE FROM entries').run();
    sqlite.prepare('DELETE FROM emotions').run();

    const insertEmotion = sqlite.prepare(
      `INSERT INTO emotions (id, sync_id, name, slug, color, active, is_system, created_at, updated_at)
       VALUES (@id, @syncId, @name, @slug, @color, @active, @isSystem, @createdAt, @updatedAt)`,
    );
    for (const emotion of payload.emotions) {
      insertEmotion.run({
        id: emotion.id,
        syncId: emotion.syncId,
        name: emotion.name,
        slug: emotion.slug,
        color: emotion.color,
        active: emotion.active ? 1 : 0,
        isSystem: emotion.isSystem ? 1 : 0,
        createdAt: emotion.createdAt,
        updatedAt: emotion.updatedAt,
      });
    }

    const insertEntry = sqlite.prepare(
      `INSERT INTO entries (date, note, primary_emotion_id, primary_color, created_at, updated_at)
       VALUES (@date, @note, @primaryEmotionId, @primaryColor, @createdAt, @updatedAt)`,
    );
    const insertRelation = sqlite.prepare(
      `INSERT INTO entry_emotions (entry_date, emotion_id, position)
       VALUES (@entryDate, @emotionId, @position)`,
    );

    for (const entry of payload.entries) {
      insertEntry.run({
        date: entry.date,
        note: entry.note,
        primaryEmotionId: entry.primaryEmotionId,
        primaryColor: entry.primaryColor,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      });

      entry.emotions.forEach((emotion, index) => {
        insertRelation.run({
          entryDate: entry.date,
          emotionId: emotion.id,
          position: index,
        });
      });
    }
  });

  transaction(snapshot);
}

export async function createSqliteBackup(userId = DEFAULT_LOCAL_USER_ID) {
  initializeDatabase(userId);
  const targetPath = getTemporaryFilePath('emotional-calendar-backup', 'sqlite');
  await getSqlite(userId).backup(targetPath);
  const fileBuffer = fs.readFileSync(targetPath);
  fs.rmSync(targetPath, { force: true });
  return {
    filename: `emotional-calendar-${new Date().toISOString().slice(0, 10)}.sqlite`,
    fileBuffer,
  };
}

export function restoreSqliteBackup(fileBuffer: Buffer, userId = DEFAULT_LOCAL_USER_ID) {
  const uploadPath = getTemporaryFilePath('emotional-calendar-restore', 'sqlite');
  fs.writeFileSync(uploadPath, fileBuffer);

  try {
    ensureUploadIntegrity(uploadPath);
    replaceDatabaseFile(uploadPath, userId);
  } finally {
    fs.rmSync(uploadPath, { force: true });
  }
}

export async function exportIncrementalChanges(since: string | null, userId = DEFAULT_LOCAL_USER_ID) {
  const { emotionRepository, entryRepository } = getRepositories(userId);
  const [emotions, entries] = await Promise.all([
    emotionRepository.listAll(true),
    entryRepository.listAll(),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    emotions: since ? emotions.filter((emotion) => emotion.updatedAt.localeCompare(since) > 0) : emotions,
    entries: since ? entries.filter((entry) => entry.updatedAt.localeCompare(since) > 0) : entries,
    emotionDeletions: listEmotionDeletionsSince(since, userId),
    entryDeletions: listEntryDeletionsSince(since, userId),
  } satisfies SyncChangesPayload;
}

export function importIncrementalChanges(payload: SyncChangesPayload, userId = DEFAULT_LOCAL_USER_ID) {
  const sqlite = getSqlite(userId);
  const transaction = sqlite.transaction((incoming: SyncChangesPayload) => {
    for (const emotion of incoming.emotions) {
      const localDeletion = getEmotionDeletion(emotion.id, userId)?.deletedAt;
      if (localDeletion && isMoreRecent(localDeletion, emotion.updatedAt)) {
        continue;
      }

      const localEmotion = sqlite.prepare('SELECT updated_at as updatedAt FROM emotions WHERE id = ?').get(emotion.id) as { updatedAt?: string } | undefined;
      if (localEmotion?.updatedAt && isMoreRecent(localEmotion.updatedAt, emotion.updatedAt)) {
        continue;
      }

      upsertSyncEmotion(emotion, userId);
      clearEmotionDeletion(emotion.id, userId);
    }

    for (const entry of incoming.entries) {
      const localDeletion = getEntryDeletion(entry.date, userId)?.deletedAt;
      if (localDeletion && isMoreRecent(localDeletion, entry.updatedAt)) {
        continue;
      }

      const localEntry = sqlite.prepare('SELECT updated_at as updatedAt FROM entries WHERE date = ?').get(entry.date) as { updatedAt?: string } | undefined;
      if (localEntry?.updatedAt && isMoreRecent(localEntry.updatedAt, entry.updatedAt)) {
        continue;
      }

      upsertSyncEntry(entry, userId);
      clearEntryDeletion(entry.date, userId);
    }

    for (const deletion of incoming.entryDeletions) {
      const localEntry = sqlite.prepare('SELECT updated_at as updatedAt FROM entries WHERE date = ?').get(deletion.date) as { updatedAt?: string } | undefined;
      if (localEntry?.updatedAt && isMoreRecent(localEntry.updatedAt, deletion.deletedAt)) {
        continue;
      }

      deleteSyncEntry(deletion.date, deletion.deletedAt, userId);
    }

    for (const deletion of incoming.emotionDeletions) {
      const localEmotion = sqlite.prepare('SELECT updated_at as updatedAt FROM emotions WHERE id = ?').get(deletion.id) as { updatedAt?: string } | undefined;
      if (localEmotion?.updatedAt && isMoreRecent(localEmotion.updatedAt, deletion.deletedAt)) {
        continue;
      }

      deleteSyncEmotion(deletion.id, deletion.deletedAt, userId);
    }
  });

  transaction(payload);
}

export async function pushIncrementalChangesToRemote(userId = DEFAULT_LOCAL_USER_ID) {
  const since = readSyncCursor('push', userId);
  const payload = await exportIncrementalChanges(since, userId);
  if (!hasSyncChanges(payload)) {
    return { pushed: false };
  }

  const response = await fetch(getSyncChangesUrl(), {
    method: 'POST',
    headers: getSyncHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = (await response.json()) as { error?: string };
    throw new Error(body.error ?? 'No se pudieron enviar los cambios incrementales al remoto.');
  }

  writeSyncCursor('push', payload.generatedAt, userId);
  return { pushed: true };
}

export async function pullIncrementalChangesFromRemote(userId = DEFAULT_LOCAL_USER_ID) {
  const since = readSyncCursor('pull', userId);
  const url = new URL(getSyncChangesUrl());
  if (since) {
    url.searchParams.set('since', since);
  }

  const response = await fetch(url, {
    headers: {
      'x-sync-token': getSyncHeaders()['x-sync-token'],
    },
  });

  if (!response.ok) {
    const body = (await response.json()) as { error?: string };
    throw new Error(body.error ?? 'No se pudieron descargar los cambios incrementales remotos.');
  }

  const payload = (await response.json()) as SyncChangesPayload;
  importIncrementalChanges(payload, userId);
  writeSyncCursor('pull', payload.generatedAt, userId);
  return payload;
}

export async function pushSnapshotToRemote(userId = DEFAULT_LOCAL_USER_ID) {
  const response = await fetch(getSyncSnapshotUrl(), {
    method: 'PUT',
    headers: getSyncHeaders(),
    body: JSON.stringify(await exportDatabaseSnapshot(userId)),
  });

  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? 'No se pudo enviar el snapshot al servidor remoto.');
  }
}

export async function pullSnapshotFromRemote(userId = DEFAULT_LOCAL_USER_ID) {
  const response = await fetch(getSyncSnapshotUrl(), {
    headers: {
      'x-sync-token': getSyncHeaders()['x-sync-token'],
    },
  });

  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? 'No se pudo descargar el snapshot remoto.');
  }

  const snapshot = (await response.json()) as DatabaseSnapshot;
  importDatabaseSnapshot(snapshot, userId);
}