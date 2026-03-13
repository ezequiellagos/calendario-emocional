import type { APIRoute } from 'astro';

import { emotionIdSchema, emotionSchema } from '@/features/emotions/schemas';
import { requireRequestUserId } from '@/lib/auth';
import { removeEmotion, updateEmotion } from '@/services/emotion-service';
import { jsonError, jsonResponse } from '@/utils/api-response';

export const prerender = false;

export const PATCH: APIRoute = async ({ locals, params, request }) => {
  const auth = requireRequestUserId(locals);
  if (auth.kind === 'redirect') {
    return auth.response;
  }

  try {
    const { id } = emotionIdSchema.parse(params);
    const body: unknown = await request.json();
    const payload = emotionSchema.parse(body);
    return jsonResponse(await updateEmotion(id, payload, auth.userId));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'No se pudo actualizar la emocion.');
  }
};

export const DELETE: APIRoute = async ({ locals, params }) => {
  const auth = requireRequestUserId(locals);
  if (auth.kind === 'redirect') {
    return auth.response;
  }

  try {
    const { id } = emotionIdSchema.parse(params);
    return jsonResponse(await removeEmotion(id, auth.userId));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'No se pudo eliminar la emocion.');
  }
};