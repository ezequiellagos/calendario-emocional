import { MongoClient } from 'mongodb';

import { readServerEnvTrimmed } from '@/lib/server-env';

let clientPromise: Promise<MongoClient> | null = null;
let clientInstance: MongoClient | null = null;
let clientUri: string | null = null;

function getMongoUri() {
  return readServerEnvTrimmed('MONGODB_URI');
}

function getMongoDbName() {
  return readServerEnvTrimmed('MONGODB_DB_NAME') || 'emotional-calendar';
}

export function isMongoConfigured() {
  return Boolean(getMongoUri());
}

export async function getMongoClient() {
  const uri = getMongoUri();
  if (!uri) {
    throw new Error('MONGODB_URI no esta configurada.');
  }

  if (clientInstance && clientUri === uri) {
    return clientInstance;
  }

  if (clientPromise && clientUri === uri) {
    return clientPromise;
  }

  const client = new MongoClient(uri);
  clientUri = uri;
  clientPromise = client.connect()
    .then((connectedClient) => {
      clientInstance = connectedClient;
      return connectedClient;
    })
    .catch(async (error) => {
      clientPromise = null;
      clientInstance = null;
      clientUri = null;
      await client.close().catch(() => undefined);
      throw error;
    });

  return clientPromise;
}

export async function getMongoDatabase() {
  const client = await getMongoClient();
  return client.db(getMongoDbName());
}

export async function resetMongoClient() {
  const currentClient = clientInstance;
  const currentPromise = clientPromise;

  clientInstance = null;
  clientPromise = null;
  clientUri = null;

  if (currentClient) {
    await currentClient.close().catch(() => undefined);
    return;
  }

  if (!currentPromise) {
    return;
  }

  try {
    const resolvedClient = await currentPromise;
    await resolvedClient.close().catch(() => undefined);
  } catch {
    // Ignora conexiones fallidas ya descartadas del cache.
  }
}