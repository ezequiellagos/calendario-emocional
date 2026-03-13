import type { APIRoute } from 'astro';

import { requireRequestUserId } from '@/lib/auth';
import { runManualSync, SyncCooldownError } from '@/services/mongo-sync-service';
import { jsonError, jsonResponse } from '@/utils/api-response';

export const prerender = false;

export const POST: APIRoute = async ({ locals }) => {
  const auth = requireRequestUserId(locals);
  if (auth.kind === 'redirect') {
    return auth.response;
  }

  try {
    return jsonResponse(await runManualSync(auth.userId));
  } catch (error) {
    if (error instanceof SyncCooldownError) {
      return jsonError(error.message, 429);
    }

    return jsonError(error instanceof Error ? error.message : 'No se pudo completar la sincronizacion.', 500);
  }
};