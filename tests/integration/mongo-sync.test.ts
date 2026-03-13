import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { closeDatabase } from '@/db/client';
import { resetMongoClient } from '@/db/mongo-client';
import { resetRepositories } from '@/repositories';
import { listEmotions } from '@/services/emotion-service';
import { listEntriesByYear, saveEntry } from '@/services/entry-service';
import { pullChangesFromMongo, pushLocalChangesToMongo } from '@/services/mongo-sync-service';

import type { SyncOperationPayload } from '@/types/system';

describe('incremental mongo sync between temporary instances', () => {
  let mongoServer: MongoMemoryServer;
  let mongoUri: string;
  let mongoDbName: string;
  let directoryA: string;
  let directoryB: string;
  let previousDatabasePath: string | undefined;
  let previousMongoUri: string | undefined;
  let previousMongoDbName: string | undefined;
  let previousInstanceId: string | undefined;
  let previousDisableAutoSync: string | undefined;

  async function activateInstance(databasePath: string, instanceId: string) {
    process.env.DATABASE_PATH = databasePath;
    process.env.MONGODB_URI = mongoUri;
    process.env.MONGODB_DB_NAME = mongoDbName;
    process.env.INSTANCE_ID = instanceId;
    process.env.DISABLE_AUTO_MONGO_SYNC = '1';
    closeDatabase();
    resetRepositories();
    await resetMongoClient();
  }

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    mongoUri = mongoServer.getUri();
    mongoDbName = `calendar-sync-${randomUUID()}`;
    directoryA = fs.mkdtempSync(path.join(os.tmpdir(), 'calendar-sync-a-'));
    directoryB = fs.mkdtempSync(path.join(os.tmpdir(), 'calendar-sync-b-'));
    previousDatabasePath = process.env.DATABASE_PATH;
    previousMongoUri = process.env.MONGODB_URI;
    previousMongoDbName = process.env.MONGODB_DB_NAME;
    previousInstanceId = process.env.INSTANCE_ID;
    previousDisableAutoSync = process.env.DISABLE_AUTO_MONGO_SYNC;
  });

  afterEach(async () => {
    closeDatabase();
    resetRepositories();
    await resetMongoClient();
    if (mongoUri && mongoDbName) {
      const mongoClient = new MongoClient(mongoUri);
      await mongoClient.connect();
      await mongoClient.db(mongoDbName).dropDatabase();
      await mongoClient.close();
    }
  });

  afterAll(async () => {
    closeDatabase();
    resetRepositories();
    await resetMongoClient();
    if (previousDatabasePath) {
      process.env.DATABASE_PATH = previousDatabasePath;
    } else {
      delete process.env.DATABASE_PATH;
    }
    if (previousMongoUri) {
      process.env.MONGODB_URI = previousMongoUri;
    } else {
      delete process.env.MONGODB_URI;
    }
    if (previousMongoDbName) {
      process.env.MONGODB_DB_NAME = previousMongoDbName;
    } else {
      delete process.env.MONGODB_DB_NAME;
    }
    if (previousInstanceId) {
      process.env.INSTANCE_ID = previousInstanceId;
    } else {
      delete process.env.INSTANCE_ID;
    }
    if (previousDisableAutoSync) {
      process.env.DISABLE_AUTO_MONGO_SYNC = previousDisableAutoSync;
    } else {
      delete process.env.DISABLE_AUTO_MONGO_SYNC;
    }
    fs.rmSync(directoryA, { recursive: true, force: true });
    fs.rmSync(directoryB, { recursive: true, force: true });
    await mongoServer.stop();
  });

  it('syncs changes between two SQLite instances and merges non-overlapping fields', async () => {
    const databasePathA = path.join(directoryA, 'emotional-calendar.sqlite');
    const databasePathB = path.join(directoryB, 'emotional-calendar.sqlite');

    await activateInstance(databasePathA, 'instance-a');
    await saveEntry({
      date: '2026-03-13',
      note: 'Nota creada en A',
      emotionIds: [1],
      primaryEmotionId: 1,
    });
    await pushLocalChangesToMongo();

    const mongoClient = new MongoClient(mongoUri);
    await mongoClient.connect();
    const centralEntriesCollection = mongoClient.db(mongoDbName).collection<{ _id: string }>('emotional_calendar_entries');
    const centralEmotionsCollection = mongoClient.db(mongoDbName).collection<{ _id: string }>('emotional_calendar_emotions');
    const centralEntriesCount = await centralEntriesCollection.countDocuments();
    const centralEmotionsCount = await centralEmotionsCollection.countDocuments();
    const centralJoyEmotion = await centralEmotionsCollection.findOne({ _id: 'local-default:system-alegria' });
    await mongoClient.close();

    expect(centralEntriesCount).toBe(1);
    expect(centralEmotionsCount).toBeGreaterThan(0);
    expect(centralJoyEmotion?._id).toBe('local-default:system-alegria');

    await activateInstance(databasePathB, 'instance-b');
    await pullChangesFromMongo();
    const instanceBEntries = await listEntriesByYear(2026);
    expect(instanceBEntries).toHaveLength(1);
    expect(instanceBEntries[0]?.note).toBe('Nota creada en A');

    await activateInstance(databasePathA, 'instance-a');
    await pullChangesFromMongo();
    await saveEntry({
      date: '2026-03-13',
      note: 'Nota actualizada en A',
      emotionIds: [1],
      primaryEmotionId: 1,
    });
    await pushLocalChangesToMongo();

    await activateInstance(databasePathB, 'instance-b');
    await pullChangesFromMongo();
    const entryBeforeLocalChange = (await listEntriesByYear(2026))[0];
    await saveEntry({
      date: '2026-03-13',
      note: entryBeforeLocalChange?.note ?? 'Nota actualizada en A',
      emotionIds: [1, 5],
      primaryEmotionId: 5,
    });
    await pushLocalChangesToMongo();

    await activateInstance(databasePathA, 'instance-a');
    await pullChangesFromMongo();
    const finalEntries = await listEntriesByYear(2026);

    expect(finalEntries).toHaveLength(1);
    expect(finalEntries[0]?.note).toBe('Nota actualizada en A');
    expect(finalEntries[0]?.emotions.map((emotion) => emotion.slug)).toEqual(['alegria', 'calma']);
    expect(finalEntries[0]?.primaryEmotionId).toBe(5);
  });

  it('applies remote operations even when an entry arrives before its emotion dependency', async () => {
    const databasePathB = path.join(directoryB, 'out-of-order.sqlite');
    const customEmotionSyncId = randomUUID();
    const entryOccurredAt = '2026-03-13T10:00:00.000Z';
    const emotionOccurredAt = '2026-03-13T10:00:01.000Z';
    const operationsCollectionName = 'emotional_calendar_operations';
    const mongoClient = new MongoClient(mongoUri);
    const remoteOperations: Array<SyncOperationPayload & { _id: string }> = [
      {
        _id: 'op-entry-out-of-order',
        id: 'op-entry-out-of-order',
        userId: 'local-default',
        originInstanceId: 'instance-a',
        entityType: 'entry',
        entityKey: '2026-03-14',
        occurredAt: entryOccurredAt,
        kind: 'upsert',
        changes: {
          note: { value: 'Creada desde remoto', updatedAt: entryOccurredAt },
          primaryEmotionSyncId: { value: customEmotionSyncId, updatedAt: entryOccurredAt },
          primaryColor: { value: '#123456', updatedAt: entryOccurredAt },
          emotionSyncIds: { value: [customEmotionSyncId], updatedAt: entryOccurredAt },
          createdAt: { value: entryOccurredAt, updatedAt: entryOccurredAt },
        },
      },
      {
        _id: 'op-emotion-out-of-order',
        id: 'op-emotion-out-of-order',
        userId: 'local-default',
        originInstanceId: 'instance-a',
        entityType: 'emotion',
        entityKey: customEmotionSyncId,
        occurredAt: emotionOccurredAt,
        kind: 'upsert',
        changes: {
          name: { value: 'Remota especial', updatedAt: emotionOccurredAt },
          slug: { value: 'remota-especial', updatedAt: emotionOccurredAt },
          color: { value: '#123456', updatedAt: emotionOccurredAt },
          active: { value: true, updatedAt: emotionOccurredAt },
          isSystem: { value: false, updatedAt: emotionOccurredAt },
          createdAt: { value: emotionOccurredAt, updatedAt: emotionOccurredAt },
        },
      },
    ];

    await mongoClient.connect();
    await mongoClient
      .db(mongoDbName)
      .collection<SyncOperationPayload & { _id: string }>(operationsCollectionName)
      .insertMany(remoteOperations);

    await activateInstance(databasePathB, 'instance-b');
    await expect(pullChangesFromMongo()).resolves.toEqual({ pulled: 2, applied: 2 });

    const syncedEntries = await listEntriesByYear(2026);
    const syncedEmotions = await listEmotions();

    expect(syncedEntries).toHaveLength(1);
    expect(syncedEntries[0]?.note).toBe('Creada desde remoto');
    expect(syncedEntries[0]?.emotions.map((emotion) => emotion.syncId)).toEqual([customEmotionSyncId]);
    expect(syncedEmotions.some((emotion) => emotion.syncId === customEmotionSyncId && emotion.slug === 'remota-especial')).toBe(true);

    await mongoClient.close();
  });
});