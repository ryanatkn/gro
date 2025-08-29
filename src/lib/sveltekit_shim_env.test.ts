import {describe, test, expect} from 'vitest';
import {resolve} from 'node:path';
import {existsSync} from 'node:fs';

import {resolve_gro_module_path, spawn_with_loader} from './gro_helpers.ts';
import {TEST_TIMEOUT_MD} from './test_helpers.ts';

describe('sveltekit shim env', () => {
	test(
		'shims SvelteKit $env imports',
		async () => {
			const testScript = resolve('src/fixtures/test_sveltekit_env_subprocess.ts');

			// Log test script path for debugging
			console.log('Test script path:', testScript);
			console.log('Test script exists:', existsSync(testScript));

			// Use the same loader resolution logic as the CLI
			const loaderPath = resolve_gro_module_path('loader.js');

			// Use the existing spawn_with_loader function
			const result = await spawn_with_loader(loaderPath, testScript, []);

			expect(result.ok).toBe(true);
			expect(result.code).toBe(0);
		},
		TEST_TIMEOUT_MD,
	);
});
