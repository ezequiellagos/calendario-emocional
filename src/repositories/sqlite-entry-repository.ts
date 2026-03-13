import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

import { emotionsTable, entriesTable, entryDeletionsTable, entryEmotionsTable } from '@/db/schema';
import { recordLocalOperation } from '@/db/sync-operations';
import { getYearDateRange } from '@/utils/dates';

import type { EntryRepository } from '@/repositories/contracts';
import type { EntryInput, EntryRecord } from '@/types/entry';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

type JoinedRow = {
  entry: typeof entriesTable.$inferSelect;
  emotion:
    | {
        id: number;
        syncId: string | null;
        name: string;
        slug: string;
        color: string;
      }
    | null;
  relation:
    | {
        position: number;
      }
    | null;
};

function groupRows(rows: JoinedRow[]): EntryRecord[] {
  const grouped = new Map<string, EntryRecord>();

  for (const row of rows) {
    const existing = grouped.get(row.entry.date);
    if (!existing) {
      grouped.set(row.entry.date, {
        date: row.entry.date,
        note: row.entry.note,
        primaryEmotionId: row.entry.primaryEmotionId,
        primaryColor: row.entry.primaryColor,
        createdAt: row.entry.createdAt,
        updatedAt: row.entry.updatedAt,
        emotions: [],
      });
    }

    if (row.emotion) {
      grouped.get(row.entry.date)?.emotions.push({
        id: row.emotion.id,
        syncId: row.emotion.syncId ?? '',
        name: row.emotion.name,
        slug: row.emotion.slug,
        color: row.emotion.color,
      });
    }
  }

  return Array.from(grouped.values()).sort((left, right) => left.date.localeCompare(right.date));
}

export class SQLiteEntryRepository implements EntryRepository {
  constructor(private readonly db: BetterSQLite3Database, private readonly userId: string) {}

  async listAll(): Promise<EntryRecord[]> {
    const rows = await this.db
      .select({
        entry: entriesTable,
        emotion: {
          id: emotionsTable.id,
          syncId: emotionsTable.syncId,
          name: emotionsTable.name,
          slug: emotionsTable.slug,
          color: emotionsTable.color,
        },
        relation: {
          position: entryEmotionsTable.position,
        },
      })
      .from(entriesTable)
      .leftJoin(entryEmotionsTable, eq(entriesTable.date, entryEmotionsTable.entryDate))
      .leftJoin(emotionsTable, eq(entryEmotionsTable.emotionId, emotionsTable.id))
      .orderBy(asc(entriesTable.date), asc(entryEmotionsTable.position));

    return groupRows(rows);
  }

  async listByYear(year: number): Promise<EntryRecord[]> {
    const { start, end } = getYearDateRange(year);
    const rows = await this.db
      .select({
        entry: entriesTable,
        emotion: {
          id: emotionsTable.id,
          syncId: emotionsTable.syncId,
          name: emotionsTable.name,
          slug: emotionsTable.slug,
          color: emotionsTable.color,
        },
        relation: {
          position: entryEmotionsTable.position,
        },
      })
      .from(entriesTable)
      .leftJoin(entryEmotionsTable, eq(entriesTable.date, entryEmotionsTable.entryDate))
      .leftJoin(emotionsTable, eq(entryEmotionsTable.emotionId, emotionsTable.id))
      .where(and(gte(entriesTable.date, start), lte(entriesTable.date, end)))
      .orderBy(asc(entriesTable.date), asc(entryEmotionsTable.position));

    return groupRows(rows);
  }

  async getByDate(date: string): Promise<EntryRecord | null> {
    const rows = await this.db
      .select({
        entry: entriesTable,
        emotion: {
          id: emotionsTable.id,
          syncId: emotionsTable.syncId,
          name: emotionsTable.name,
          slug: emotionsTable.slug,
          color: emotionsTable.color,
        },
        relation: {
          position: entryEmotionsTable.position,
        },
      })
      .from(entriesTable)
      .leftJoin(entryEmotionsTable, eq(entriesTable.date, entryEmotionsTable.entryDate))
      .leftJoin(emotionsTable, eq(entryEmotionsTable.emotionId, emotionsTable.id))
      .where(eq(entriesTable.date, date))
      .orderBy(asc(entryEmotionsTable.position));

    if (rows.length === 0) {
      return null;
    }

    return groupRows(rows)[0] ?? null;
  }

  async upsert(input: EntryInput & { primaryColor: string | null }): Promise<EntryRecord> {
    const existing = await this.getByDate(input.date);
    const timestamp = new Date().toISOString();

    if (existing) {
      await this.db
        .update(entriesTable)
        .set({
          note: input.note,
          primaryEmotionId: input.primaryEmotionId ?? null,
          primaryColor: input.primaryColor,
          updatedAt: timestamp,
        })
        .where(eq(entriesTable.date, input.date));
      await this.db.delete(entryEmotionsTable).where(eq(entryEmotionsTable.entryDate, input.date));
    } else {
      await this.db.insert(entriesTable).values({
        date: input.date,
        note: input.note,
        primaryEmotionId: input.primaryEmotionId ?? null,
        primaryColor: input.primaryColor,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    if (input.emotionIds.length > 0) {
      await this.db.insert(entryEmotionsTable).values(
        input.emotionIds.map((emotionId, index) => ({
          entryDate: input.date,
          emotionId,
          position: index,
        })),
      );
    }

    await this.db.delete(entryDeletionsTable).where(eq(entryDeletionsTable.entryDate, input.date));

    const savedEntry = (await this.getByDate(input.date)) as EntryRecord;
    const primaryEmotionSyncId = savedEntry.primaryEmotionId == null
      ? null
      : savedEntry.emotions.find((emotion) => emotion.id === savedEntry.primaryEmotionId)?.syncId ?? null;
    const previousEmotionSyncIds = existing?.emotions.map((emotion) => emotion.syncId) ?? [];
    const nextEmotionSyncIds = savedEntry.emotions.map((emotion) => emotion.syncId);
    const changes: Record<string, { value: boolean | number | string | string[] | null; updatedAt: string }> = {};

    if (!existing || existing.note !== savedEntry.note) {
      changes.note = { value: savedEntry.note, updatedAt: savedEntry.updatedAt };
    }
    if (!existing || existing.primaryColor !== savedEntry.primaryColor) {
      changes.primaryColor = { value: savedEntry.primaryColor, updatedAt: savedEntry.updatedAt };
    }
    if (!existing || (existing.primaryEmotionId ?? null) !== (savedEntry.primaryEmotionId ?? null)) {
      changes.primaryEmotionSyncId = { value: primaryEmotionSyncId, updatedAt: savedEntry.updatedAt };
    }
    if (!existing || JSON.stringify(previousEmotionSyncIds) !== JSON.stringify(nextEmotionSyncIds)) {
      changes.emotionSyncIds = { value: nextEmotionSyncIds, updatedAt: savedEntry.updatedAt };
    }
    if (!existing) {
      changes.createdAt = { value: savedEntry.createdAt, updatedAt: savedEntry.createdAt };
    }

    if (Object.keys(changes).length > 0) {
      recordLocalOperation(this.db, this.userId, {
        entityType: 'entry',
        entityKey: savedEntry.date,
        occurredAt: savedEntry.updatedAt,
        kind: 'upsert',
        changes,
      });
    }

    return savedEntry;
  }

  async delete(date: string): Promise<void> {
    const existing = await this.getByDate(date);
    const timestamp = new Date().toISOString();
    await this.db
      .insert(entryDeletionsTable)
      .values({
        entryDate: date,
        deletedAt: timestamp,
      })
      .onConflictDoUpdate({
        target: entryDeletionsTable.entryDate,
        set: {
          deletedAt: sql.raw(`excluded.${entryDeletionsTable.deletedAt.name}`),
        },
      });
    await this.db.delete(entriesTable).where(eq(entriesTable.date, date));
    if (existing) {
      recordLocalOperation(this.db, this.userId, {
        entityType: 'entry',
        entityKey: date,
        occurredAt: timestamp,
        kind: 'delete',
        changes: {
          deletedAt: { value: timestamp, updatedAt: timestamp },
        },
      });
    }
  }
}