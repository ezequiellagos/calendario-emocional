import type { APIRoute } from 'astro';

import { requireRequestUserId } from '@/lib/auth';
import { pullChangesFromMongo } from '@/services/mongo-sync-service';
import { jsonError, jsonResponse } from '@/utils/api-response';

export const prerender = false;

export const POST: APIRoute = async ({ locals }) => {
  const auth = requireRequestUserId(locals);
  if (auth.kind === 'redirect') {
    return auth.response;
  }

  try {
    const payload = await pullChangesFromMongo(auth.userId);
    return jsonResponse({
      message: payload.pulled > 0
        ? `Cambios traidos desde Mongo: ${payload.pulled}; aplicados localmente: ${payload.applied}.`
        : 'No habia cambios remotos pendientes.',
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'No se pudo descargar el remoto.', 500);
  }
};