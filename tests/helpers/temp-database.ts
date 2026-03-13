import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { closeDatabase } from '@/db/client';
import { resetMongoClient } from '@/db/mongo-client';
import { resetRepositories } from '@/repositories';

export interface TempDatabaseContext {
  databasePath: string;
  cleanup: () => void;
}

interface TempDatabaseOptions {
  mongoUri?: string;
  mongoDbName?: string;
  instanceId?: string;
}

export function createTempDatabaseContext(prefix: string, options: TempDatabaseOptions = {}): TempDatabaseContext {
  const directoryPath = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
  const databasePath = path.join(directoryPath, 'emotional-calendar.sqlite');
  const previousDatabasePath = process.env.DATABASE_PATH;
  const previousMongoUri = process.env.MONGODB_URI;
  const previousMongoDbName = process.env.MONGODB_DB_NAME;
  const previousInstanceId = process.env.INSTANCE_ID;

  process.env.DATABASE_PATH = databasePath;
  if (options.mongoUri) {
    process.env.MONGODB_URI = options.mongoUri;
  } else {
    delete process.env.MONGODB_URI;
  }
  if (options.mongoDbName) {
    process.env.MONGODB_DB_NAME = options.mongoDbName;
  } else {
    delete process.env.MONGODB_DB_NAME;
  }
  if (options.instanceId) {
    process.env.INSTANCE_ID = options.instanceId;
  } else {
    delete process.env.INSTANCE_ID;
  }
  closeDatabase();
  resetRepositories();

  return {
    databasePath,
    cleanup: () => {
      closeDatabase();
      resetRepositories();
      void resetMongoClient();
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
      fs.rmSync(directoryPath, { recursive: true, force: true });
    },
  };
}