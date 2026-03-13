import { z } from 'zod';

export const entrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim().max(2400).default(''),
  emotionIds: z.array(z.number().int().positive()).min(1),
  primaryEmotionId: z.number().int().positive().nullable().optional(),
});

export const dateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});