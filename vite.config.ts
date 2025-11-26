import {defineConfig} from 'vitest/config';
import {sveltekit} from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		// Isolate test files to prevent vi.mock pollution between tests
		isolate: true,
	},
});
