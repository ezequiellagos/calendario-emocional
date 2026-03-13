export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const headers = new Headers(init?.headers ?? undefined);

  if (!isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(input, {
    ...init,
    headers,
  });

  const payload = response.status === 204 ? null : (await response.json()) as T | { error?: string };
  if (!response.ok) {
    throw new Error((payload as { error?: string }).error ?? 'No se pudo completar la solicitud.');
  }

  return payload as T;
}