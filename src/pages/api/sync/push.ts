import type { APIRoute } from 'astro';

import { requireRequestUserId } from '@/lib/auth';
import { pushLocalChangesToMongo } from '@/services/mongo-sync-service';
import { jsonError, jsonResponse } from '@/utils/api-response';

export const prerender = false;

export const POST: APIRoute = async ({ locals }) => {
  const auth = requireRequestUserId(locals);
  if (auth.kind === 'redirect') {
    return auth.response;
  }

  try {
    const result = await pushLocalChangesToMongo(auth.userId);
    return jsonResponse({ message: result.pushed > 0 ? `Cambios locales enviados a Mongo: ${result.pushed}.` : 'No habia cambios locales para enviar.' });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'No se pudo sincronizar con el remoto.', 500);
  }
};