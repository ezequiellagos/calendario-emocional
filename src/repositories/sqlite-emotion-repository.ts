import { randomUUID } from 'node:crypto';

import { asc, eq, sql } from 'drizzle-orm';

import { emotionDeletionsTable, entryEmotionsTable, emotionsTable } from '@/db/schema';
import { recordLocalOperation } from '@/db/sync-operations';

import type { EmotionRepository } from '@/repositories/contracts';
import type { Emotion, EmotionInput, EmotionOption } from '@/types/emotion';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

function mapEmotion(row: typeof emotionsTable.$inferSelect): Emotion {
  return {
    id: row.id,
    syncId: row.syncId ?? '',
    name: row.name,
    slug: row.slug,
    color: row.color,
    active: row.active,
    isSystem: row.isSystem,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class SQLiteEmotionRepository implements EmotionRepository {
  constructor(private readonly db: BetterSQLite3Database, private readonly userId: string) {}

  async listAll(includeInactive = true): Promise<Emotion[]> {
    const rows = await this.db
      .select()
      .from(emotionsTable)
      .where(includeInactive ? undefined : eq(emotionsTable.active, true))
      .orderBy(asc(emotionsTable.name));

    return rows.map(mapEmotion);
  }

  async getByIds(ids: number[]): Promise<EmotionOption[]> {
    if (ids.length === 0) {
      return [];
    }

    const placeholders = sql.join(ids.map((id) => sql`${id}`), sql.raw(', '));
    const rows = await this.db
      .select({
        id: emotionsTable.id,
        syncId: emotionsTable.syncId,
        name: emotionsTable.name,
        slug: emotionsTable.slug,
        color: emotionsTable.color,
      })
      .from(emotionsTable)
      .where(sql`${emotionsTable.id} IN (${placeholders})`)
      .orderBy(asc(emotionsTable.name));

    const order = new Map(ids.map((id, index) => [id, index]));
    return rows
      .map((row) => ({
        ...row,
        syncId: row.syncId ?? '',
      }))
      .sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
  }

  async create(input: EmotionInput & { slug: string; isSystem?: boolean }): Promise<Emotion> {
    const now = new Date().toISOString();
    const result = await this.db
      .insert(emotionsTable)
      .values({
        syncId: randomUUID(),
        name: input.name,
        slug: input.slug,
        color: input.color,
        active: input.active ?? true,
        isSystem: input.isSystem ?? false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await this.db.delete(emotionDeletionsTable).where(eq(emotionDeletionsTable.emotionId, result[0].id));

    recordLocalOperation(this.db, this.userId, {
      entityType: 'emotion',
      entityKey: result[0].syncId ?? '',
      occurredAt: result[0].updatedAt,
      kind: 'upsert',
      changes: {
        name: { value: result[0].name, updatedAt: result[0].updatedAt },
        slug: { value: result[0].slug, updatedAt: result[0].updatedAt },
        color: { value: result[0].color, updatedAt: result[0].updatedAt },
        active: { value: result[0].active, updatedAt: result[0].updatedAt },
        isSystem: { value: result[0].isSystem, updatedAt: result[0].updatedAt },
        createdAt: { value: result[0].createdAt, updatedAt: result[0].createdAt },
      },
    });

    return mapEmotion(result[0]);
  }

  async update(id: number, input: EmotionInput): Promise<Emotion> {
    const existing = this.db.select().from(emotionsTable).where(eq(emotionsTable.id, id)).get();
    const result = await this.db
      .update(emotionsTable)
      .set({
        name: input.name,
        color: input.color,
        active: input.active ?? true,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(emotionsTable.id, id))
      .returning();

    await this.db.delete(emotionDeletionsTable).where(eq(emotionDeletionsTable.emotionId, id));

    const updated = result[0];
    if (existing) {
      const changes: Record<string, { value: boolean | number | string | string[] | null; updatedAt: string }> = {};
      if (existing.name !== updated.name) {
        changes.name = { value: updated.name, updatedAt: updated.updatedAt };
      }
      if (existing.color !== updated.color) {
        changes.color = { value: updated.color, updatedAt: updated.updatedAt };
      }
      if (existing.active !== updated.active) {
        changes.active = { value: updated.active, updatedAt: updated.updatedAt };
      }
      if (Object.keys(changes).length > 0) {
        recordLocalOperation(this.db, this.userId, {
          entityType: 'emotion',
          entityKey: updated.syncId ?? '',
          occurredAt: updated.updatedAt,
          kind: 'upsert',
          changes,
        });
      }
    }

    return mapEmotion(updated);
  }

  async deleteIfUnused(id: number): Promise<{ deleted: boolean; reason?: string }> {
    const existing = this.db.select().from(emotionsTable).where(eq(emotionsTable.id, id)).get();
    const usage = await this.db
      .select({ total: sql<number>`count(*)` })
      .from(entryEmotionsTable)
      .where(eq(entryEmotionsTable.emotionId, id));

    if ((usage[0]?.total ?? 0) > 0) {
      const updatedAt = new Date().toISOString();
      await this.db
        .update(emotionsTable)
        .set({ active: false, updatedAt })
        .where(eq(emotionsTable.id, id));
      if (existing?.syncId) {
        recordLocalOperation(this.db, this.userId, {
          entityType: 'emotion',
          entityKey: existing.syncId,
          occurredAt: updatedAt,
          kind: 'upsert',
          changes: {
            active: { value: false, updatedAt },
          },
        });
      }
      return { deleted: false, reason: 'La emocion tiene registros asociados y fue desactivada.' };
    }

    const timestamp = new Date().toISOString();
    await this.db
      .insert(emotionDeletionsTable)
      .values({
        emotionId: id,
        deletedAt: timestamp,
      })
      .onConflictDoUpdate({
        target: emotionDeletionsTable.emotionId,
        set: {
          deletedAt: sql.raw(`excluded.${emotionDeletionsTable.deletedAt.name}`),
        },
      });
    await this.db.delete(emotionsTable).where(eq(emotionsTable.id, id));
    if (existing?.syncId) {
      recordLocalOperation(this.db, this.userId, {
        entityType: 'emotion',
        entityKey: existing.syncId,
        occurredAt: timestamp,
        kind: 'delete',
        changes: {
          deletedAt: { value: timestamp, updatedAt: timestamp },
        },
      });
    }
    return { deleted: true };
  }
}