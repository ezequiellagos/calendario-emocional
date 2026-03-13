import type { APIRoute } from 'astro';

import { requireRequestUserId } from '@/lib/auth';
import { runAutomaticSync } from '@/services/mongo-sync-service';
import { jsonError, jsonResponse } from '@/utils/api-response';

export const prerender = false;

export const POST: APIRoute = async ({ locals }) => {
  const auth = requireRequestUserId(locals);
  if (auth.kind === 'redirect') {
    return auth.response;
  }

  try {
    return jsonResponse(await runAutomaticSync(auth.userId));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'No se pudo completar la sincronizacion automatica.', 500);
  }
};