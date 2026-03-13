import { beforeEach, describe, expect, it, vi } from 'vitest';

const closeMock = vi.fn(() => Promise.resolve(undefined));
const connectMock = vi.fn(function connect(this: { close: () => Promise<void> }) {
  return Promise.resolve(this);
});

vi.mock('mongodb', () => ({
  MongoClient: vi.fn().mockImplementation(function MongoClient(this: { uri: string; connect: typeof connectMock; close: typeof closeMock }, uri: string) {
    this.uri = uri;
    this.connect = connectMock;
    this.close = closeMock;
  }),
}));

describe('mongo client cache', () => {
  beforeEach(() => {
    vi.resetModules();
    connectMock.mockReset();
    closeMock.mockReset();
    delete process.env.MONGODB_URI;
  });

  it('retries a connection after an initial failure without requiring a process restart', async () => {
    process.env.MONGODB_URI = 'mongodb://example.test:27017';
    connectMock
      .mockImplementationOnce(() => {
        throw new Error('initial connection failure');
      })
      .mockImplementation(function retryConnect(this: { close: () => Promise<void> }) {
        return Promise.resolve(this);
      });

    const { getMongoClient, resetMongoClient } = await import('@/db/mongo-client');

    await expect(getMongoClient()).rejects.toThrow('initial connection failure');
    await expect(getMongoClient()).resolves.toMatchObject({ uri: 'mongodb://example.test:27017' });
    await expect(resetMongoClient()).resolves.toBeUndefined();
    expect(connectMock).toHaveBeenCalledTimes(2);
  });
});