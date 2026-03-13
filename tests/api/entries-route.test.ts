import { beforeEach, describe, expect, it, vi } from 'vitest';

const entryServiceState = vi.hoisted(() => ({
  listEntriesByYear: vi.fn(),
  saveEntry: vi.fn(),
  deleteEntry: vi.fn(),
}));

vi.mock('@/services/entry-service', () => ({
  listEntriesByYear: entryServiceState.listEntriesByYear,
  saveEntry: entryServiceState.saveEntry,
  deleteEntry: entryServiceState.deleteEntry,
}));

import { DELETE, GET, POST } from '@/pages/api/entries/index';

describe('entries api route', () => {
  beforeEach(() => {
    entryServiceState.listEntriesByYear.mockReset();
    entryServiceState.saveEntry.mockReset();
    entryServiceState.deleteEntry.mockReset();
  });

  it('returns entries for a requested year', async () => {
    entryServiceState.listEntriesByYear.mockResolvedValue([{ date: '2026-01-01', emotions: [] }]);

    const response = await GET({
      locals: {
        auth: () => ({
          userId: 'user_entries',
        }),
      },
      url: new URL('http://localhost/api/entries?year=2026'),
    } as never);
    const payload = await response.json() as Array<{ date: string; emotions: unknown[] }>;

    expect(response.status).toBe(200);
    expect(entryServiceState.listEntriesByYear).toHaveBeenCalledWith(2026, 'user_entries');
    expect(payload).toEqual([{ date: '2026-01-01', emotions: [] }]);
  });

  it('uses the authenticated Clerk user id when present in locals', async () => {
    entryServiceState.listEntriesByYear.mockResolvedValue([{ date: '2026-01-01', emotions: [] }]);

    const response = await GET({
      locals: {
        auth: () => ({
          userId: 'user_2abc',
        }),
      },
      url: new URL('http://localhost/api/entries?year=2026'),
    } as never);

    expect(response.status).toBe(200);
    expect(entryServiceState.listEntriesByYear).toHaveBeenCalledWith(2026, 'user_2abc');
  });

  it('blocks access when Clerk locals resolve without a user id', async () => {
    const response = await GET({
      locals: {
        auth: () => ({
          userId: null,
          redirectToSignIn: () => new Response(JSON.stringify({ error: 'auth-required' }), { status: 401 }),
        }),
      },
      url: new URL('http://localhost/api/entries?year=2026'),
    } as never);
    const payload = await response.json() as { error: string };

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: 'auth-required' });
    expect(entryServiceState.listEntriesByYear).not.toHaveBeenCalled();
  });

  it('validates and stores posted entries', async () => {
    entryServiceState.saveEntry.mockResolvedValue({ date: '2026-03-13', emotions: [] });

    const response = await POST({
      locals: {
        auth: () => ({
          userId: 'user_entries',
        }),
      },
      request: new Request('http://localhost/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: '2026-03-13',
          note: 'Dia estable',
          emotionIds: [1],
          primaryEmotionId: 1,
        }),
      }),
    } as never);
    const payload = await response.json() as { date: string; emotions: unknown[] };

    expect(response.status).toBe(200);
    expect(entryServiceState.saveEntry).toHaveBeenCalledWith(
      {
        date: '2026-03-13',
        note: 'Dia estable',
        emotionIds: [1],
        primaryEmotionId: 1,
      },
      'user_entries',
    );
    expect(payload).toEqual({ date: '2026-03-13', emotions: [] });
  });

  it('rejects unauthenticated requests when Clerk middleware is missing', async () => {
    const response = await GET({
      url: new URL('http://localhost/api/entries?year=2026'),
    } as never);
    const payload = await response.json() as { error: string };

    expect(response.status).toBe(401);
    expect(payload.error).toContain('Debes iniciar sesión');
    expect(entryServiceState.listEntriesByYear).not.toHaveBeenCalled();
  });

  it('rejects delete requests without date', async () => {
    const response = await DELETE({
      locals: {
        auth: () => ({
          userId: 'user_entries',
        }),
      },
      url: new URL('http://localhost/api/entries'),
    } as never);
    const payload = await response.json() as { error: string };

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: 'La fecha es obligatoria para eliminar un registro.' });
  });
});