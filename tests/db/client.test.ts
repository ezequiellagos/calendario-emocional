import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

describe('db client per-user paths', () => {
  afterEach(() => {
    delete process.env.DATABASE_PATH;
  });

  it('builds a distinct sanitized SQLite path for each user', async () => {
    process.env.DATABASE_PATH = path.join(process.cwd(), 'data', 'emotional-calendar.sqlite');

    const { getDatabasePath } = await import('@/db/client');

    const firstUserPath = getDatabasePath('user:alpha@example.com');
    const secondUserPath = getDatabasePath('user-beta');

    expect(firstUserPath).toContain(path.join('users', 'user_alpha_example_com'));
    expect(secondUserPath).toContain(path.join('users', 'user-beta'));
    expect(firstUserPath).not.toBe(secondUserPath);
  });
});