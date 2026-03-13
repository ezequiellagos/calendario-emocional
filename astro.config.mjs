// @ts-check
import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'astro/config';
import clerk from '@clerk/astro';
import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

const allowedHosts = true;

// https://astro.build/config
export default defineConfig({
	output: 'server',
	adapter: node({
		mode: 'standalone',
	}),
	integrations: [clerk(), react()],
	vite: {
		server: {
			allowedHosts,
		},
		preview: {
			allowedHosts,
		},
		plugins: [tailwindcss()],
		resolve: {
			alias: {
				'@': fileURLToPath(new URL('./src', import.meta.url)),
			},
		},
	},
});
