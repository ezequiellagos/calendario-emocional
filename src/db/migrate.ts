import { sql } from 'drizzle-orm';

import { migrationsTable } from '@/db/schema';

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import { APP_MIGRATIONS } from './migrations';

function splitSqlStatements(sqlSource: string) {
  return sqlSource
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export function applyMigrations(db: BetterSQLite3Database) {
  db.run(sql.raw('CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)'));

  const applied = new Set(
    db.select({ id: migrationsTable.id }).from(migrationsTable).all().map((row) => row.id),
  );

  const now = new Date().toISOString();
  for (const migration of APP_MIGRATIONS) {
    if (applied.has(migration.id)) {
      continue;
    }

    db.transaction((transaction) => {
      for (const statement of splitSqlStatements(migration.sql)) {
        transaction.run(sql.raw(statement));
      }
      transaction.insert(migrationsTable).values({ id: migration.id, appliedAt: now }).run();
    });
  }
}