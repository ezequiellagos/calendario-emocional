import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';

import { syncStateTable } from '@/db/schema';
import { readServerEnvTrimmed } from '@/lib/server-env';

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

export function getSyncStateValue(db: BetterSQLite3Database, key: string) {
  const row = db.select({ value: syncStateTable.value }).from(syncStateTable).where(eq(syncStateTable.key, key)).get();
  return row?.value ?? null;
}

export function setSyncStateValue(db: BetterSQLite3Database, key: string, value: string) {
  const updatedAt = new Date().toISOString();
  db.insert(syncStateTable)
    .values({ key, value, updatedAt })
    .onConflictDoUpdate({
      target: syncStateTable.key,
      set: { value, updatedAt },
    })
    .run();
}

export function getOrCreateInstanceId(db: BetterSQLite3Database) {
  const environmentInstanceId = readServerEnvTrimmed('INSTANCE_ID');
  if (environmentInstanceId) {
    setSyncStateValue(db, 'instance-id', environmentInstanceId);
    return environmentInstanceId;
  }

  const existing = getSyncStateValue(db, 'instance-id');
  if (existing) {
    return existing;
  }

  const instanceId = randomUUID();
  setSyncStateValue(db, 'instance-id', instanceId);
  return instanceId;
}