// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyOfflineQueue,
  createOfflineOperation,
  loadOfflineQueue,
  saveOfflineQueue,
} from '@/utils/offline-queue';

describe('offline queue browser integration', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal('crypto', {
      randomUUID: () => 'offline-op-id',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('persists queued operations in localStorage and rehydrates UI state', () => {
    const queue = [
      createOfflineOperation({
        kind: 'create-emotion',
        payload: {
          clientId: -1,
          input: {
            name: 'Curiosidad',
            color: '#06b6d4',
            active: true,
          },
        },
      }),
      createOfflineOperation({
        kind: 'save-entry',
        payload: {
          date: '2026-03-13',
          note: 'Guardado en cola offline',
          emotionIds: [-1],
          primaryEmotionId: -1,
        },
      }),
    ];

    saveOfflineQueue(queue);
    const reloadedQueue = loadOfflineQueue();
    const hydratedState = applyOfflineQueue({ entries: [], emotions: [] }, reloadedQueue);

    expect(reloadedQueue).toHaveLength(2);
    expect(hydratedState.emotions[0]?.slug).toBe('curiosidad');
    expect(hydratedState.entries[0]?.emotions[0]?.id).toBe(-1);
    expect(hydratedState.entries[0]?.note).toBe('Guardado en cola offline');
  });

  it('clears invalid stored payloads instead of breaking hydration', () => {
    window.localStorage.setItem('emotional-calendar.offline-queue.local-default', '{not-json');

    const queue = loadOfflineQueue();

    expect(queue).toEqual([]);
    expect(window.localStorage.getItem('emotional-calendar.offline-queue.local-default')).toBeNull();
  });

  it('keeps offline queues isolated per user id', () => {
    const queueA = [
      createOfflineOperation({
        kind: 'delete-entry',
        payload: { date: '2026-03-13' },
      }),
    ];
    const queueB = [
      createOfflineOperation({
        kind: 'delete-entry',
        payload: { date: '2026-03-14' },
      }),
    ];

    saveOfflineQueue(queueA, 'user-a');
    saveOfflineQueue(queueB, 'user-b');

    expect(loadOfflineQueue('user-a').map((operation) => operation.payload)).toEqual([{ date: '2026-03-13' }]);
    expect(loadOfflineQueue('user-b').map((operation) => operation.payload)).toEqual([{ date: '2026-03-14' }]);
  });
});