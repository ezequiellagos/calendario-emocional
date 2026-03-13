import { entrySchema } from '@/features/entries/schemas';
import { DEFAULT_LOCAL_USER_ID } from '@/db/client';
import { getRepositories } from '@/repositories';
import { syncLocalChangeToMongo } from '@/services/mongo-sync-service';

import type { EntryInput } from '@/types/entry';

export async function listEntriesByYear(year: number, userId = DEFAULT_LOCAL_USER_ID) {
  const { entryRepository } = getRepositories(userId);
  return entryRepository.listByYear(year);
}

export async function getEntryByDate(date: string, userId = DEFAULT_LOCAL_USER_ID) {
  const { entryRepository } = getRepositories(userId);
  return entryRepository.getByDate(date);
}

export async function saveEntry(input: EntryInput, userId = DEFAULT_LOCAL_USER_ID) {
  const parsed = entrySchema.parse(input);
  const { emotionRepository, entryRepository } = getRepositories(userId);
  const emotions = await emotionRepository.getByIds(parsed.emotionIds);

  if (emotions.length !== parsed.emotionIds.length) {
    throw new Error('Alguna emocion seleccionada no existe o ya no esta disponible.');
  }

  const primaryEmotion = emotions.find((emotion) => emotion.id === parsed.primaryEmotionId) ?? emotions[0];

  const saved = await entryRepository.upsert({
    ...parsed,
    primaryEmotionId: primaryEmotion?.id ?? null,
    primaryColor: primaryEmotion?.color ?? null,
  });
  void syncLocalChangeToMongo(userId);
  return saved;
}

export async function deleteEntry(date: string, userId = DEFAULT_LOCAL_USER_ID) {
  const { entryRepository } = getRepositories(userId);
  await entryRepository.delete(date);
  void syncLocalChangeToMongo(userId);
}