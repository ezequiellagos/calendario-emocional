import { fetchJson } from '@/utils/http';

import type { Emotion } from '@/types/emotion';
import type { EntryInput, EntryRecord } from '@/types/entry';
import type { OfflineOperation } from '@/utils/offline-queue';

export async function replayOfflineQueue(queue: OfflineOperation[]) {
  const emotionIdMap = new Map<number, number>();

  for (const operation of queue) {
    if (operation.kind === 'create-emotion') {
      const created = await fetchJson<Emotion>('/api/emotions', {
        method: 'POST',
        body: JSON.stringify(operation.payload.input),
      });
      emotionIdMap.set(operation.payload.clientId, created.id);
      continue;
    }

    if (operation.kind === 'update-emotion') {
      const emotionId = emotionIdMap.get(operation.payload.id) ?? operation.payload.id;
      await fetchJson<Emotion>(`/api/emotions/${emotionId}`, {
        method: 'PATCH',
        body: JSON.stringify(operation.payload.input),
      });
      continue;
    }

    if (operation.kind === 'delete-emotion') {
      const emotionId = emotionIdMap.get(operation.payload.id) ?? operation.payload.id;
      await fetchJson<{ deleted: boolean; reason?: string }>(`/api/emotions/${emotionId}`, {
        method: 'DELETE',
      });
      continue;
    }

    if (operation.kind === 'save-entry') {
      const emotionIds = operation.payload.emotionIds.map((emotionId) => emotionIdMap.get(emotionId) ?? emotionId);
      const primaryEmotionId = operation.payload.primaryEmotionId == null
        ? operation.payload.primaryEmotionId
        : emotionIdMap.get(operation.payload.primaryEmotionId) ?? operation.payload.primaryEmotionId;

      await fetchJson<EntryRecord>('/api/entries', {
        method: 'POST',
        body: JSON.stringify({
          ...operation.payload,
          emotionIds,
          primaryEmotionId,
        } satisfies EntryInput),
      });
      continue;
    }

    await fetchJson<{ success: boolean }>(`/api/entries?date=${operation.payload.date}`, { method: 'DELETE' });
  }
}