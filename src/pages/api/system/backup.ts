import type { APIRoute } from 'astro';

import { requireRequestUserId } from '@/lib/auth';
import { createSqliteBackup } from '@/services/system-service';
import { jsonError } from '@/utils/api-response';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const auth = requireRequestUserId(locals);
  if (auth.kind === 'redirect') {
    return auth.response;
  }

  try {
    const { filename, fileBuffer } = await createSqliteBackup(auth.userId);
    return new Response(fileBuffer, {
      headers: {
        'Content-Type': 'application/vnd.sqlite3',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'No se pudo crear el backup de SQLite.', 500);
  }
};