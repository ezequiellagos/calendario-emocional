import type { APIRoute } from 'astro';

import { requireRequestUserId } from '@/lib/auth';
import { getMonthlyStats } from '@/services/stats-service';
import { jsonError, jsonResponse } from '@/utils/api-response';

export const prerender = false;

export const GET: APIRoute = async ({ locals, url }) => {
  const auth = requireRequestUserId(locals);
  if (auth.kind === 'redirect') {
    return auth.response;
  }

  try {
    const year = Number.parseInt(url.searchParams.get('year') ?? `${new Date().getFullYear()}`, 10);
    return jsonResponse(await getMonthlyStats(year, auth.userId));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'No se pudieron calcular las estadisticas mensuales.');
  }
};