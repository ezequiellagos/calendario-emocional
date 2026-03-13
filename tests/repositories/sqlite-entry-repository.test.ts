import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { applyMigrations } from '@/db/migrate';
import { emotionsTable } from '@/db/schema';
import { SQLiteEntryRepository } from '@/repositories/sqlite-entry-repository';

describe('SQLiteEntryRepository', () => {
  let databasePath: string;
  let sqlite: Database.Database;
  let repository: SQLiteEntryRepository;

  beforeEach(() => {
    databasePath = path.join(os.tmpdir(), `calendar-entry-repository-${Date.now()}.sqlite`);
    sqlite = new Database(databasePath);
    sqlite.pragma('foreign_keys = ON');
    sqlite.pragma('journal_mode = WAL');

    const db = drizzle(sqlite);
    applyMigrations(db);
    db.insert(emotionsTable)
      .values([
        {
          syncId: 'emotion-alegria',
          name: 'Alegria',
          slug: 'alegria',
          color: '#f59e0b',
          active: true,
          isSystem: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          syncId: 'emotion-calma',
          name: 'Calma',
          slug: 'calma',
          color: '#14b8a6',
          active: true,
          isSystem: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ])
      .run();

    repository = new SQLiteEntryRepository(db, 'local-default');
  });

  afterEach(() => {
    sqlite.close();
    for (const suffix of ['', '-wal', '-shm']) {
      const candidate = `${databasePath}${suffix}`;
      if (fs.existsSync(candidate)) {
        fs.rmSync(candidate, { force: true });
      }
    }
  });

  it('persists and reads entries with multiple emotions', async () => {
    const saved = await repository.upsert({
      date: '2026-03-10',
      note: 'Dia con energia y serenidad',
      emotionIds: [1, 2],
      primaryEmotionId: 2,
      primaryColor: '#14b8a6',
    });

    expect(saved.primaryEmotionId).toBe(2);
    expect(saved.emotions).toHaveLength(2);
    expect(saved.emotions.map((emotion) => emotion.slug)).toEqual(['alegria', 'calma']);

    const listed = await repository.listByYear(2026);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.date).toBe('2026-03-10');

    const allEntries = await repository.listAll();
    expect(allEntries).toHaveLength(1);
  });
});