import { beforeEach, describe, expect, it, vi } from 'vitest';

const repositoriesState = vi.hoisted(() => ({
  emotionRepository: {
    getByIds: vi.fn(),
  },
  entryRepository: {
    listAll: vi.fn(),
    listByYear: vi.fn(),
    getByDate: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/repositories', () => ({
  getRepositories: () => repositoriesState,
}));

import { saveEntry } from '@/services/entry-service';

describe('entry-service', () => {
  beforeEach(() => {
    repositoriesState.emotionRepository.getByIds.mockReset();
    repositoriesState.entryRepository.upsert.mockReset();
  });

  it('uses the first selected emotion as fallback primary emotion', async () => {
    repositoriesState.emotionRepository.getByIds.mockResolvedValue([
      { id: 3, syncId: 'emotion-calma', name: 'Calma', slug: 'calma', color: '#14b8a6' },
      { id: 9, syncId: 'emotion-ternura', name: 'Ternura', slug: 'ternura', color: '#fb7185' },
    ]);
    repositoriesState.entryRepository.upsert.mockImplementation((payload) => Promise.resolve({
      ...payload,
      createdAt: '2026-03-13T00:00:00.000Z',
      updatedAt: '2026-03-13T00:00:00.000Z',
      emotions: [
        { id: 3, syncId: 'emotion-calma', name: 'Calma', slug: 'calma', color: '#14b8a6' },
        { id: 9, syncId: 'emotion-ternura', name: 'Ternura', slug: 'ternura', color: '#fb7185' },
      ],
    }));

    const result = await saveEntry({
      date: '2026-03-13',
      note: 'Dia equilibrado',
      emotionIds: [3, 9],
      primaryEmotionId: null,
    });

    expect(repositoriesState.entryRepository.upsert).toHaveBeenCalledWith({
      date: '2026-03-13',
      note: 'Dia equilibrado',
      emotionIds: [3, 9],
      primaryEmotionId: 3,
      primaryColor: '#14b8a6',
    });
    expect(result.primaryEmotionId).toBe(3);
  });
});