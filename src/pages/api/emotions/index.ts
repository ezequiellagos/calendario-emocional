import type { APIRoute } from 'astro';

import { emotionSchema } from '@/features/emotions/schemas';
import { requireRequestUserId } from '@/lib/auth';
import { createEmotion, listEmotions } from '@/services/emotion-service';
import { jsonError, jsonResponse } from '@/utils/api-response';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const auth = requireRequestUserId(locals);
  if (auth.kind === 'redirect') {
    return auth.response;
  }

  return jsonResponse(await listEmotions(true, auth.userId));
};

export const POST: APIRoute = async ({ locals, request }) => {
  const auth = requireRequestUserId(locals);
  if (auth.kind === 'redirect') {
    return auth.response;
  }

  try {
    const body: unknown = await request.json();
    const payload = emotionSchema.parse(body);
    return jsonResponse(await createEmotion(payload, auth.userId), 201);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'No se pudo crear la emocion.');
  }
};