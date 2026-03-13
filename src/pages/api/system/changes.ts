import type { APIRoute } from 'astro';

import { syncChangesSchema } from '@/features/system/schemas';
import { getRequestUserId } from '@/lib/auth';
import { readServerEnvTrimmed } from '@/lib/server-env';
import { exportIncrementalChanges, getSyncConfiguration, importIncrementalChanges } from '@/services/system-service';
import { jsonError, jsonResponse } from '@/utils/api-response';

export const prerender = false;

function isAuthorized(request: Request) {
  const configuredToken = readServerEnvTrimmed('SYNC_SHARED_TOKEN');
  if (!configuredToken) {
    return false;
  }

  return request.headers.get('x-sync-token') === configuredToken;
}

export const GET: APIRoute = async ({ locals, request, url }) => {
  if (!isAuthorized(request)) {
    return jsonError('Token de sincronizacion invalido.', 401);
  }

  try {
    const since = url.searchParams.get('since');
    return jsonResponse(await exportIncrementalChanges(since, getRequestUserId(locals) ?? undefined));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'No se pudieron exportar los cambios incrementales.', 500);
  }
};

export const POST: APIRoute = async ({ locals, request }) => {
  if (!isAuthorized(request)) {
    return jsonError('Token de sincronizacion invalido.', 401);
  }

  try {
    const body: unknown = await request.json();
    const payload = syncChangesSchema.parse(body);
    importIncrementalChanges(payload, getRequestUserId(locals) ?? undefined);
    return jsonResponse({ message: 'Cambios incrementales aplicados.' });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'No se pudieron importar los cambios incrementales.', 500);
  }
};

export const HEAD: APIRoute = () => {
  const configuration = getSyncConfiguration();
  return new Response(null, {
    status: configuration.enabled ? 204 : 503,
  });
};