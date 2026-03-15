import { clerkMiddleware } from '@clerk/astro/server';
import { defineMiddleware, sequence } from 'astro:middleware';

function setNoStore(headers: Headers) {
	headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
	headers.set('CDN-Cache-Control', 'no-store');
	headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
	headers.set('Pragma', 'no-cache');
}

function setImmutable(headers: Headers) {
	headers.set('Cache-Control', 'public, max-age=31536000, immutable');
	headers.set('CDN-Cache-Control', 'public, max-age=31536000, immutable');
	headers.set('Cloudflare-CDN-Cache-Control', 'public, max-age=31536000, immutable');
}

const cacheControlMiddleware = defineMiddleware(async ({ request, url }, next) => {
	const response = await next();
	const accept = request.headers.get('accept') ?? '';
	const pathname = url.pathname;

	if (request.method !== 'GET') {
		return response;
	}

	if (pathname === '/sw.js' || pathname === '/manifest.webmanifest' || pathname.endsWith('.html')) {
		setNoStore(response.headers);
		return response;
	}

	if (accept.includes('text/html')) {
		setNoStore(response.headers);
		return response;
	}

	if (pathname.startsWith('/_astro/') || pathname.startsWith('/chunks/')) {
		setImmutable(response.headers);
	}

	return response;
});

export const onRequest = sequence(cacheControlMiddleware, clerkMiddleware());