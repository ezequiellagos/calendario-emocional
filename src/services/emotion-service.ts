import { emotionSchema } from '@/features/emotions/schemas';
import { DEFAULT_LOCAL_USER_ID } from '@/db/client';
import { getRepositories } from '@/repositories';
import { syncLocalChangeToMongo } from '@/services/mongo-sync-service';
import { slugify } from '@/utils/slug';

import type { EmotionInput } from '@/types/emotion';

export async function listEmotions(includeInactive = true, userId = DEFAULT_LOCAL_USER_ID) {
  const { emotionRepository } = getRepositories(userId);
  return emotionRepository.listAll(includeInactive);
}

export async function createEmotion(input: EmotionInput, userId = DEFAULT_LOCAL_USER_ID) {
  const parsed = emotionSchema.parse(input);
  const { emotionRepository } = getRepositories(userId);
  const created = await emotionRepository.create({
    ...parsed,
    slug: slugify(parsed.name),
  });
  void syncLocalChangeToMongo(userId);
  return created;
}

export async function updateEmotion(id: number, input: EmotionInput, userId = DEFAULT_LOCAL_USER_ID) {
  const parsed = emotionSchema.parse(input);
  const { emotionRepository } = getRepositories(userId);
  const updated = await emotionRepository.update(id, parsed);
  void syncLocalChangeToMongo(userId);
  return updated;
}

export async function removeEmotion(id: number, userId = DEFAULT_LOCAL_USER_ID) {
  const { emotionRepository } = getRepositories(userId);
  const result = await emotionRepository.deleteIfUnused(id);
  void syncLocalChangeToMongo(userId);
  return result;
}