import { beforeEach, describe, expect, it, vi } from 'vitest';

const syncServiceState = vi.hoisted(() => ({
  runManualSync: vi.fn(),
}));

vi.mock('@/services/mongo-sync-service', () => {
  class SyncCooldownError extends Error {
    constructor(public readonly availableAt: string) {
      super(`Debes esperar hasta ${availableAt} antes de volver a sincronizar manualmente.`);
      this.name = 'SyncCooldownError';
    }
  }

  return {
    runManualSync: syncServiceState.runManualSync,
    SyncCooldownError,
  };
});

import { POST } from '@/pages/api/sync/index';
import { SyncCooldownError } from '@/services/mongo-sync-service';

describe('sync api route', () => {
  beforeEach(() => {
    syncServiceState.runManualSync.mockReset();
  });

  it('runs a manual sync with the authenticated user id', async () => {
    syncServiceState.runManualSync.mockResolvedValue({
      pushed: 1,
      pulled: 2,
      applied: 2,
      message: 'ok',
    });

    const response = await POST({
      locals: {
        auth: () => ({
          userId: 'user_sync',
        }),
      },
    } as never);
    const payload = await response.json() as { message: string; pushed: number };

    expect(response.status).toBe(200);
    expect(syncServiceState.runManualSync).toHaveBeenCalledWith('user_sync');
    expect(payload.message).toBe('ok');
  });

  it('returns 429 when the manual sync is still in cooldown', async () => {
    syncServiceState.runManualSync.mockRejectedValue(new SyncCooldownError('2026-03-13T12:01:00.000Z'));

    const response = await POST({
      locals: {
        auth: () => ({
          userId: 'user_sync',
        }),
      },
    } as never);
    const payload = await response.json() as { error: string };

    expect(response.status).toBe(429);
    expect(payload.error).toContain('2026-03-13T12:01:00.000Z');
  });
});