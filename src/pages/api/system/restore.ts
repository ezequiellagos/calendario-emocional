import { Buffer } from 'node:buffer';

import type { APIRoute } from 'astro';

import { requireRequestUserId } from '@/lib/auth';
import { readServerEnvTrimmed } from '@/lib/server-env';
import { restoreSqliteBackup } from '@/services/system-service';
import { jsonError, jsonResponse } from '@/utils/api-response';

export const prerender = false;

const DEFAULT_MAX_SQLITE_BACKUP_UPLOAD_BYTES = 10 * 1024 * 1024;

function getMaxSqliteBackupUploadBytes() {
  const configuredLimit = Number.parseInt(readServerEnvTrimmed('MAX_SQLITE_BACKUP_UPLOAD_BYTES') ?? '', 10);
  return Number.isFinite(configuredLimit) && configuredLimit > 0
    ? configuredLimit
    : DEFAULT_MAX_SQLITE_BACKUP_UPLOAD_BYTES;
}

export const POST: APIRoute = async ({ locals, request }) => {
  const auth = requireRequestUserId(locals);
  if (auth.kind === 'redirect') {
    return auth.response;
  }

  try {
    const formData = await request.formData();
    const uploaded = formData.get('file');
    if (!(uploaded instanceof File)) {
      return jsonError('Debes seleccionar un archivo SQLite valido.');
    }

    if (uploaded.size <= 0) {
      return jsonError('El archivo SQLite está vacío.');
    }

    const maxUploadBytes = getMaxSqliteBackupUploadBytes();
    if (uploaded.size > maxUploadBytes) {
      return jsonError(`El archivo SQLite supera el límite permitido de ${Math.floor(maxUploadBytes / (1024 * 1024))} MB.`, 413);
    }

    const buffer = Buffer.from(await uploaded.arrayBuffer());
    restoreSqliteBackup(buffer, auth.userId);
    return jsonResponse({ message: 'Base restaurada correctamente.' });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'No se pudo restaurar la base de datos.', 500);
  }
};