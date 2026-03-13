import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import { applyMigrations } from '@/db/migrate';
import { INITIAL_EMOTIONS } from '@/db/seed';
import { emotionsTable } from '@/db/schema';
import { readServerEnv } from '@/lib/server-env';

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

const defaultDatabasePath = path.join(process.cwd(), 'data', 'emotional-calendar.sqlite');
export const DEFAULT_LOCAL_USER_ID = 'local-default';

function sanitizeUserId(userId: string) {
  return userId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function resolveDatabasePath(userId = DEFAULT_LOCAL_USER_ID) {
  const configuredDatabasePath = readServerEnv('DATABASE_PATH') ?? defaultDatabasePath;
  const parsedPath = path.parse(configuredDatabasePath);
  const userDirectory = path.join(parsedPath.dir, 'users', sanitizeUserId(userId));
  return path.join(userDirectory, parsedPath.base);
}

export function getDatabasePath(userId = DEFAULT_LOCAL_USER_ID) {
  return resolveDatabasePath(userId);
}

function ensureDatabaseDirectory(databasePath: string) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
}

const dbInstances = new Map<string, BetterSQLite3Database>();
const sqliteInstances = new Map<string, Database.Database>();
const initializedDatabases = new Set<string>();

function seedInitialEmotions(db: BetterSQLite3Database) {
  const existing = db.select({ id: emotionsTable.id }).from(emotionsTable).limit(1).get();
  if (existing) {
    return;
  }

  const now = new Date().toISOString();
  db.insert(emotionsTable)
    .values(
      INITIAL_EMOTIONS.map((emotion) => ({
        syncId: `system-${emotion.slug}`,
        name: emotion.name,
        slug: emotion.slug,
        color: emotion.color,
        active: true,
        isSystem: true,
        createdAt: now,
        updatedAt: now,
      })),
    )
    .run();
}

export function getDb(userId = DEFAULT_LOCAL_USER_ID) {
  const databasePath = resolveDatabasePath(userId);
  const existingDb = dbInstances.get(databasePath);
  if (existingDb) {
    return existingDb;
  }

  const db = drizzle(getSqlite(userId));
  dbInstances.set(databasePath, db);
  return db;
}

export function getSqlite(userId = DEFAULT_LOCAL_USER_ID) {
  const databasePath = resolveDatabasePath(userId);
  const existingSqlite = sqliteInstances.get(databasePath);
  if (existingSqlite) {
    return existingSqlite;
  }

  ensureDatabaseDirectory(databasePath);
  const sqlite = new Database(databasePath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqliteInstances.set(databasePath, sqlite);
  return sqlite;
}

export function initializeDatabase(userId = DEFAULT_LOCAL_USER_ID) {
  const databasePath = resolveDatabasePath(userId);
  if (initializedDatabases.has(databasePath)) {
    return getDb(userId);
  }

  const db = getDb(userId);
  applyMigrations(db);
  seedInitialEmotions(db);
  initializedDatabases.add(databasePath);
  return db;
}

export function closeDatabase(userId?: string) {
  const databasePaths = userId
    ? [resolveDatabasePath(userId)]
    : Array.from(new Set([...dbInstances.keys(), ...sqliteInstances.keys(), ...initializedDatabases.values()]));

  for (const databasePath of databasePaths) {
    dbInstances.delete(databasePath);
    initializedDatabases.delete(databasePath);
    const sqlite = sqliteInstances.get(databasePath);
    if (sqlite) {
      sqlite.close();
      sqliteInstances.delete(databasePath);
    }
  }
}