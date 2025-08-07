import {test, expect, describe} from 'vitest';
import {Parse_Imports_Async} from './parse_imports_async.ts';

const test_typescript_content = `
import {a} from './a.js';
import {b, c} from './b.js';
export {d} from './d.js';
`;

const test_svelte_content = `
<script>
	import {Component} from './Component.svelte';
	import {util} from '$lib/util.ts';
</script>

<Component />
`;

describe('Parse_Imports_Async', () => {
	test('synchronous fallback for small files', async () => {
		const parser = new Parse_Imports_Async({
			worker_enabled: true,
			sync_threshold_bytes: 1000, // Large threshold to force sync
		});

		const result = await parser.parse_imports('/test/file.ts', test_typescript_content);
		expect(result).toEqual(['./a.js', './b.js', './d.js']);

		await parser.dispose();
	});

	test('worker threads disabled fallback', async () => {
		const parser = new Parse_Imports_Async({
			worker_enabled: false,
		});

		const result = await parser.parse_imports('/test/file.ts', test_typescript_content);
		expect(result).toEqual(['./a.js', './b.js', './d.js']);

		await parser.dispose();
	});

	test('batch parsing with mixed file sizes', async () => {
		const parser = new Parse_Imports_Async({
			worker_enabled: false, // Use sync for predictable testing
		});

		const requests = [
			{path_id: '/test/file1.ts', contents: test_typescript_content, ignore_types: true},
			{path_id: '/test/file2.svelte', contents: test_svelte_content, ignore_types: true},
		];

		const results = await parser.parse_imports_batch(requests);

		expect(results.get('/test/file1.ts')).toEqual(['./a.js', './b.js', './d.js']);
		expect(results.get('/test/file2.svelte')).toEqual(['./Component.svelte', '$lib/util.ts']);

		await parser.dispose();
	});

	test('handles parse errors gracefully', async () => {
		const parser = new Parse_Imports_Async({
			worker_enabled: false,
		});

		// Invalid TypeScript content
		const invalid_content = 'import {broken from "./file"'; // Missing closing brace

		const result = await parser.parse_imports('/test/broken.ts', invalid_content);
		// Should return empty array or handle gracefully (depends on parse_imports implementation)
		expect(Array.isArray(result)).toBe(true);

		await parser.dispose();
	});

	test('dispose cleanup', async () => {
		const parser = new Parse_Imports_Async({
			worker_enabled: true,
			worker_pool_size: 2,
		});

		// Should not throw
		await parser.dispose();

		// Subsequent operations should still work (fallback to sync)
		const result = await parser.parse_imports('/test/file.ts', test_typescript_content);
		expect(result).toEqual(['./a.js', './b.js', './d.js']);
	});
});