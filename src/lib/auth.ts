import { readServerEnvTrimmed } from '@/lib/server-env';

const fallbackTestUserId = readServerEnvTrimmed('TEST_USER_ID');

interface AuthState {
  userId: string | null;
  isAuthenticated: boolean;
  redirectToSignIn: () => Response;
}

interface LocalsWithAuth {
  auth?: () => Partial<AuthState>;
}

type RequiredUserResult =
  | { kind: 'user'; userId: string }
  | { kind: 'redirect'; response: Response };

function createUnauthorizedResponse() {
  return new Response(JSON.stringify({ error: 'Debes iniciar sesión para continuar.' }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export function getRequestAuth(locals?: LocalsWithAuth): AuthState {
  if (typeof locals?.auth === 'function') {
    const authState = locals.auth();
    return {
      userId: authState.userId ?? null,
      isAuthenticated: Boolean(authState.userId),
      redirectToSignIn: authState.redirectToSignIn ?? createUnauthorizedResponse,
    };
  }

  if (import.meta.env.MODE === 'test' && fallbackTestUserId) {
    return {
      userId: fallbackTestUserId,
      isAuthenticated: true,
      redirectToSignIn: createUnauthorizedResponse,
    };
  }

  return {
    userId: null,
    isAuthenticated: false,
    redirectToSignIn: createUnauthorizedResponse,
  };
}

export function getRequestUserId(locals?: LocalsWithAuth) {
  return getRequestAuth(locals).userId;
}

export function requireRequestUserId(locals?: LocalsWithAuth): RequiredUserResult {
  const authState = getRequestAuth(locals);
  if (authState.userId) {
    return { kind: 'user', userId: authState.userId };
  }

  return { kind: 'redirect', response: authState.redirectToSignIn() };
}