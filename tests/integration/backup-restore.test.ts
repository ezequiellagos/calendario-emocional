import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createEmotion } from '@/services/emotion-service';
import { saveEntry, listEntriesByYear } from '@/services/entry-service';
import { createSqliteBackup, restoreSqliteBackup } from '@/services/system-service';
import { listEmotions } from '@/services/emotion-service';

import { createTempDatabaseContext } from '../helpers/temp-database';

describe('backup and restore integration', () => {
  let cleanup: () => void;

  beforeEach(() => {
    ({ cleanup } = createTempDatabaseContext('calendar-backup-restore'));
  });

  afterEach(() => {
    cleanup();
  });

  it('restores the database to the exact backed up state', async () => {
    const customEmotion = await createEmotion({
      name: 'Asombro',
      color: '#10b981',
      active: true,
    });

    await saveEntry({
      date: '2026-03-13',
      note: 'Registro previo al backup',
      emotionIds: [customEmotion.id],
      primaryEmotionId: customEmotion.id,
    });

    const backup = await createSqliteBackup();

    await saveEntry({
      date: '2026-03-14',
      note: 'Cambio posterior al backup',
      emotionIds: [customEmotion.id],
      primaryEmotionId: customEmotion.id,
    });

    restoreSqliteBackup(backup.fileBuffer);

    const restoredEntries = await listEntriesByYear(2026);
    const restoredEmotions = await listEmotions(true);

    expect(restoredEntries.map((entry) => entry.date)).toEqual(['2026-03-13']);
    expect(restoredEntries[0]?.note).toBe('Registro previo al backup');
    expect(restoredEmotions.some((emotion) => emotion.slug === 'asombro')).toBe(true);
  });
});