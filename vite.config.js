import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		port: 3000,
		host: true
	},
	optimizeDeps: {
		include: [
			'd3',
			'd3-cloud',
			'chart.js',
			'papaparse'
		]
	}
});