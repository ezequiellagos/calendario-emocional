import { z } from 'zod';

export const emotionSchema = z.object({
  name: z.string().trim().min(2).max(48),
  color: z.string().regex(/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/),
  active: z.boolean().optional(),
});

export const emotionIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});