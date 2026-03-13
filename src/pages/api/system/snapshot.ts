import type { APIRoute } from 'astro';

import { snapshotSchema } from '@/features/system/schemas';
import { getRequestUserId } from '@/lib/auth';
import { readServerEnvTrimmed } from '@/lib/server-env';
import { exportDatabaseSnapshot, getSyncConfiguration, importDatabaseSnapshot } from '@/services/system-service';
import { jsonError, jsonResponse } from '@/utils/api-response';

export const prerender = false;

function isAuthorized(request: Request) {
  const configuredToken = readServerEnvTrimmed('SYNC_SHARED_TOKEN');
  if (!configuredToken) {
    return false;
  }

  return request.headers.get('x-sync-token') === configuredToken;
}

export const GET: APIRoute = async ({ locals, request }) => {
  if (!isAuthorized(request)) {
    return jsonError('Token de sincronizacion invalido.', 401);
  }

  try {
    return jsonResponse(await exportDatabaseSnapshot(getRequestUserId(locals) ?? undefined));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'No se pudo exportar el snapshot.', 500);
  }
};

export const PUT: APIRoute = async ({ locals, request }) => {
  if (!isAuthorized(request)) {
    return jsonError('Token de sincronizacion invalido.', 401);
  }

  try {
    const body: unknown = await request.json();
    const payload = snapshotSchema.parse(body);
    importDatabaseSnapshot(payload, getRequestUserId(locals) ?? undefined);
    return jsonResponse({ message: 'Snapshot importado.' });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'No se pudo importar el snapshot.', 500);
  }
};

export const HEAD: APIRoute = () => {
  const configuration = getSyncConfiguration();
  return new Response(null, {
    status: configuration.enabled ? 204 : 503,
  });
};