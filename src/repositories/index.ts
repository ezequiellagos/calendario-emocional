import { getDatabasePath, getDb, initializeDatabase, DEFAULT_LOCAL_USER_ID } from '@/db/client';
import { SQLiteEmotionRepository } from '@/repositories/sqlite-emotion-repository';
import { SQLiteEntryRepository } from '@/repositories/sqlite-entry-repository';

const repositories = new Map<string, { emotionRepository: SQLiteEmotionRepository; entryRepository: SQLiteEntryRepository }>();

export function resetRepositories(userId?: string) {
  if (userId) {
    repositories.delete(getDatabasePath(userId));
    return;
  }

  repositories.clear();
}

export function getRepositories(userId = DEFAULT_LOCAL_USER_ID) {
  initializeDatabase(userId);
  const databasePath = getDatabasePath(userId);
  const existingRepositories = repositories.get(databasePath);
  if (existingRepositories) {
    return existingRepositories;
  }

  const db = getDb(userId);
  const nextRepositories = {
    emotionRepository: new SQLiteEmotionRepository(db, userId),
    entryRepository: new SQLiteEntryRepository(db, userId),
  };
  repositories.set(databasePath, nextRepositories);
  return nextRepositories;
}