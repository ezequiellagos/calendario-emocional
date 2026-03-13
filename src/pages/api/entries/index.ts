import type { APIRoute } from 'astro';

import { entrySchema } from '@/features/entries/schemas';
import { requireRequestUserId } from '@/lib/auth';
import { deleteEntry, listEntriesByYear, saveEntry } from '@/services/entry-service';
import { jsonError, jsonResponse } from '@/utils/api-response';

export const prerender = false;

export const GET: APIRoute = async ({ locals, url }) => {
  const auth = requireRequestUserId(locals);
  if (auth.kind === 'redirect') {
    return auth.response;
  }

  const year = Number.parseInt(url.searchParams.get('year') ?? `${new Date().getFullYear()}`, 10);
  return jsonResponse(await listEntriesByYear(year, auth.userId));
};

export const POST: APIRoute = async ({ locals, request }) => {
  const auth = requireRequestUserId(locals);
  if (auth.kind === 'redirect') {
    return auth.response;
  }

  try {
    const body: unknown = await request.json();
    const payload = entrySchema.parse(body);
    return jsonResponse(await saveEntry(payload, auth.userId));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'No se pudo guardar el registro.');
  }
};

export const DELETE: APIRoute = async ({ locals, url }) => {
  const auth = requireRequestUserId(locals);
  if (auth.kind === 'redirect') {
    return auth.response;
  }

  const date = url.searchParams.get('date');
  if (!date) {
    return jsonError('La fecha es obligatoria para eliminar un registro.');
  }

  await deleteEntry(date, auth.userId);
  return jsonResponse({ success: true });
};