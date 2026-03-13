import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const emotionsTable = sqliteTable('emotions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  syncId: text('sync_id').unique(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  color: text('color').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const entriesTable = sqliteTable('entries', {
  date: text('date').primaryKey(),
  note: text('note').notNull().default(''),
  primaryEmotionId: integer('primary_emotion_id').references(() => emotionsTable.id, {
    onDelete: 'set null',
  }),
  primaryColor: text('primary_color'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const entryEmotionsTable = sqliteTable(
  'entry_emotions',
  {
    entryDate: text('entry_date')
      .notNull()
      .references(() => entriesTable.date, { onDelete: 'cascade' }),
    emotionId: integer('emotion_id')
      .notNull()
      .references(() => emotionsTable.id, { onDelete: 'restrict' }),
    position: integer('position').notNull().default(0),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.entryDate, table.emotionId] }),
  }),
);

export const entryDeletionsTable = sqliteTable('entry_deletions', {
  entryDate: text('entry_date').primaryKey(),
  deletedAt: text('deleted_at').notNull(),
});

export const emotionDeletionsTable = sqliteTable('emotion_deletions', {
  emotionId: integer('emotion_id').primaryKey(),
  deletedAt: text('deleted_at').notNull(),
});

export const syncStateTable = sqliteTable('sync_state', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const syncOperationsTable = sqliteTable('sync_operations', {
  id: text('id').primaryKey(),
  entityType: text('entity_type').notNull(),
  entityKey: text('entity_key').notNull(),
  originInstanceId: text('origin_instance_id').notNull(),
  occurredAt: text('occurred_at').notNull(),
  kind: text('kind').notNull(),
  payload: text('payload').notNull(),
  syncedAt: text('synced_at'),
});

export const migrationsTable = sqliteTable('_migrations', {
  id: text('id').primaryKey(),
  appliedAt: text('applied_at').notNull(),
});