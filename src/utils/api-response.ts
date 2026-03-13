import type { ApiErrorPayload } from '@/types/api';

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

export function jsonError(message: string, status = 400) {
  const payload: ApiErrorPayload = { error: message };
  return jsonResponse(payload, status);
}