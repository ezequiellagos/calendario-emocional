import type { Emotion, EmotionInput, EmotionOption } from '@/types/emotion';
import type { EntryInput, EntryRecord } from '@/types/entry';

export interface EmotionRepository {
  listAll(includeInactive?: boolean): Promise<Emotion[]>;
  getByIds(ids: number[]): Promise<EmotionOption[]>;
  create(input: EmotionInput & { slug: string; isSystem?: boolean }): Promise<Emotion>;
  update(id: number, input: EmotionInput): Promise<Emotion>;
  deleteIfUnused(id: number): Promise<{ deleted: boolean; reason?: string }>;
}

export interface EntryRepository {
  listAll(): Promise<EntryRecord[]>;
  listByYear(year: number): Promise<EntryRecord[]>;
  getByDate(date: string): Promise<EntryRecord | null>;
  upsert(input: EntryInput & { primaryColor: string | null }): Promise<EntryRecord>;
  delete(date: string): Promise<void>;
}