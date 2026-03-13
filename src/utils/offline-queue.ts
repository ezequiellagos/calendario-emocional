import type { Emotion, EmotionInput } from '@/types/emotion';
import type { EntryInput, EntryRecord } from '@/types/entry';

export type OfflineOperation =
  | {
      id: string;
      kind: 'save-entry';
      payload: EntryInput;
      createdAt: string;
    }
  | {
      id: string;
      kind: 'delete-entry';
      payload: { date: string };
      createdAt: string;
    }
  | {
      id: string;
      kind: 'create-emotion';
      payload: { clientId: number; input: EmotionInput };
      createdAt: string;
    }
  | {
      id: string;
      kind: 'update-emotion';
      payload: { id: number; input: EmotionInput };
      createdAt: string;
    }
  | {
      id: string;
      kind: 'delete-emotion';
      payload: { id: number };
      createdAt: string;
    };

export interface OfflineState {
  entries: EntryRecord[];
  emotions: Emotion[];
}

const OFFLINE_QUEUE_STORAGE_KEY = 'emotional-calendar.offline-queue';

function getOfflineQueueStorageKey(userId = 'local-default') {
  return `${OFFLINE_QUEUE_STORAGE_KEY}.${encodeURIComponent(userId)}`;
}

function createTimestamp() {
  return new Date().toISOString();
}

function createFallbackSlug(name: string) {
  return name
    .normalize('NFD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

function sortEntries(entries: EntryRecord[]) {
  return [...entries].sort((left, right) => left.date.localeCompare(right.date));
}

function buildEntryRecord(input: EntryInput, emotions: Emotion[], existing: EntryRecord | null): EntryRecord {
  const selectedEmotions = input.emotionIds
    .map((emotionId) => emotions.find((emotion) => emotion.id === emotionId))
    .filter((emotion): emotion is Emotion => Boolean(emotion))
    .map((emotion) => ({
      id: emotion.id,
      syncId: emotion.syncId,
      name: emotion.name,
      slug: emotion.slug,
      color: emotion.color,
    }));
  const primaryEmotion = selectedEmotions.find((emotion) => emotion.id === input.primaryEmotionId) ?? selectedEmotions[0] ?? null;
  const now = createTimestamp();

  return {
    date: input.date,
    note: input.note,
    primaryEmotionId: primaryEmotion?.id ?? null,
    primaryColor: primaryEmotion?.color ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    emotions: selectedEmotions,
  };
}

export function createOfflineOperation(operation: Omit<OfflineOperation, 'id' | 'createdAt'>): OfflineOperation {
  return {
    ...operation,
    id: globalThis.crypto.randomUUID(),
    createdAt: createTimestamp(),
  } as OfflineOperation;
}

export function loadOfflineQueue(userId?: string) {
  if (typeof window === 'undefined') {
    return [] as OfflineOperation[];
  }

  const rawValue = window.localStorage.getItem(getOfflineQueueStorageKey(userId));
  if (!rawValue) {
    return [] as OfflineOperation[];
  }

  try {
    return JSON.parse(rawValue) as OfflineOperation[];
  } catch {
    window.localStorage.removeItem(getOfflineQueueStorageKey(userId));
    return [] as OfflineOperation[];
  }
}

export function saveOfflineQueue(queue: OfflineOperation[], userId?: string) {
  if (typeof window === 'undefined') {
    return;
  }

  if (queue.length === 0) {
    window.localStorage.removeItem(getOfflineQueueStorageKey(userId));
    return;
  }

  window.localStorage.setItem(getOfflineQueueStorageKey(userId), JSON.stringify(queue));
}

export function applyOfflineOperation(state: OfflineState, operation: OfflineOperation): OfflineState {
  switch (operation.kind) {
    case 'save-entry': {
      const existing = state.entries.find((entry) => entry.date === operation.payload.date) ?? null;
      const nextEntry = buildEntryRecord(operation.payload, state.emotions, existing);
      return {
        ...state,
        entries: sortEntries([...state.entries.filter((entry) => entry.date !== nextEntry.date), nextEntry]),
      };
    }
    case 'delete-entry': {
      return {
        ...state,
        entries: state.entries.filter((entry) => entry.date !== operation.payload.date),
      };
    }
    case 'create-emotion': {
      const now = createTimestamp();
      const nextEmotion: Emotion = {
        id: operation.payload.clientId,
        syncId: `offline-${Math.abs(operation.payload.clientId)}`,
        name: operation.payload.input.name,
        slug: createFallbackSlug(operation.payload.input.name),
        color: operation.payload.input.color,
        active: operation.payload.input.active ?? true,
        isSystem: false,
        createdAt: now,
        updatedAt: now,
      };

      return {
        ...state,
        emotions: [...state.emotions, nextEmotion].sort((left, right) => left.name.localeCompare(right.name)),
      };
    }
    case 'update-emotion': {
      return {
        emotions: state.emotions.map((emotion) => (
          emotion.id === operation.payload.id
            ? {
                ...emotion,
                ...operation.payload.input,
                updatedAt: createTimestamp(),
              }
            : emotion
        )),
        entries: state.entries.map((entry) => ({
          ...entry,
          emotions: entry.emotions.map((emotion) => {
            if (emotion.id !== operation.payload.id) {
              return emotion;
            }

            return {
              ...emotion,
              name: operation.payload.input.name,
              color: operation.payload.input.color,
            };
          }),
          primaryColor: entry.primaryEmotionId === operation.payload.id ? operation.payload.input.color : entry.primaryColor,
        })),
      };
    }
    case 'delete-emotion': {
      const isUsed = state.entries.some((entry) => entry.emotions.some((emotion) => emotion.id === operation.payload.id));
      return {
        emotions: state.emotions.map((emotion) => (
          emotion.id === operation.payload.id && isUsed ? { ...emotion, active: false, updatedAt: createTimestamp() } : emotion
        )).filter((emotion) => emotion.id !== operation.payload.id || isUsed),
        entries: state.entries,
      };
    }
    default:
      return state;
  }
}

export function applyOfflineQueue(state: OfflineState, queue: OfflineOperation[]) {
  return queue.reduce(applyOfflineOperation, state);
}

export function createTemporaryEmotionId(emotions: Emotion[], queue: OfflineOperation[]) {
  const candidateIds = [
    ...emotions.map((emotion) => emotion.id),
    ...queue.filter((operation) => operation.kind === 'create-emotion').map((operation) => operation.payload.clientId),
  ];
  const minimumId = candidateIds.length > 0 ? Math.min(...candidateIds) : 0;
  return minimumId <= 0 ? minimumId - 1 : -1;
}