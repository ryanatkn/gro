import {test, expect} from 'vitest';
import {resolve} from 'node:path';
import {existsSync} from 'node:fs';

import {resolve_gro_module_path, spawn_with_loader} from './gro_helpers.ts';

test('custom loader works in separate process', async () => {
	const testScript = resolve('src/fixtures/test_loader.ts');

	// Log test script path for debugging
	// eslint-disable-next-line no-console
	console.log('Test script path:', testScript);
	// eslint-disable-next-line no-console
	console.log('Test script exists:', existsSync(testScript));

	// Use the same loader resolution logic as the CLI
	const loaderPath = resolve_gro_module_path('loader.js');

	// eslint-disable-next-line no-console
	console.log('Resolved loader path:', loaderPath);
	// eslint-disable-next-line no-console
	console.log('Loader exists:', existsSync(loaderPath));

	// Use the existing spawn_with_loader function
	const result = await spawn_with_loader(loaderPath, testScript, []);

	// The spawn_with_loader function handles output automatically
	// Just check if the process succeeded
	expect(result.ok).toBe(true);
	expect(result.code).toBe(0);
}, 30000); // 30 second timeout for the subprocess

test('custom loader handles failures correctly', async () => {
	const testScript = resolve('src/fixtures/test_loader_failures.ts');

	// Log test script path for debugging
	// eslint-disable-next-line no-console
	console.log('Failure test script path:', testScript);
	// eslint-disable-next-line no-console
	console.log('Failure test script exists:', existsSync(testScript));

	// Use the same loader resolution logic as the CLI
	const loaderPath = resolve_gro_module_path('loader.js');

	// Use the existing spawn_with_loader function
	const result = await spawn_with_loader(loaderPath, testScript, []);

	// For failure tests, we expect the test script to fail
	// (meaning the loader correctly failed when encountering invalid files)
	expect(result.ok).toBe(false);
	expect(result.code).not.toBe(0);
}, 30000); // 30 second timeout for the subprocess
