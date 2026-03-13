import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './src/db/migrations/generated',
  dbCredentials: {
    url: process.env.DATABASE_PATH ?? './data/emotional-calendar.sqlite',
  },
});