import { z } from 'zod';

const emotionOptionSchema = z.object({
  id: z.number().int(),
  syncId: z.string(),
  name: z.string(),
  slug: z.string(),
  color: z.string(),
});

export const snapshotSchema = z.object({
  exportedAt: z.string(),
  emotions: z.array(z.object({
    id: z.number().int(),
    syncId: z.string(),
    name: z.string(),
    slug: z.string(),
    color: z.string(),
    active: z.boolean(),
    isSystem: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })),
  entries: z.array(z.object({
    date: z.string(),
    note: z.string(),
    primaryEmotionId: z.number().int().nullable(),
    primaryColor: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    emotions: z.array(emotionOptionSchema),
  })),
});

export const syncChangesSchema = z.object({
  generatedAt: z.string(),
  emotions: snapshotSchema.shape.emotions,
  entries: snapshotSchema.shape.entries,
  emotionDeletions: z.array(z.object({
    id: z.number().int(),
    deletedAt: z.string(),
  })),
  entryDeletions: z.array(z.object({
    date: z.string(),
    deletedAt: z.string(),
  })),
});