import type { APIRoute } from 'astro';

import { requireRequestUserId } from '@/lib/auth';
import { getSyncDiagnostics } from '@/services/mongo-sync-service';
import { jsonResponse } from '@/utils/api-response';

export const prerender = false;

export const GET: APIRoute = ({ locals }) => {
	const auth = requireRequestUserId(locals);
	if (auth.kind === 'redirect') {
		return auth.response;
	}

	return jsonResponse(getSyncDiagnostics(auth.userId));
};