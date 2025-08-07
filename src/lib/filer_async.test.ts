// @slop Clade Sonnet 4

import {test, expect, describe, beforeEach, afterEach} from 'vitest';
import {Filer} from './filer.ts';
import {mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {resolve} from 'node:path';

const test_dir = resolve('./test_filer_async');
const test_file = resolve(test_dir, 'test.ts');

const test_content = `
import {a} from './a.js';
import {b, c} from './b.js';
export {d} from './d.js';

export const test = 'value';
`;

describe('Filer async loading', () => {
	let filer: Filer;

	beforeEach(() => {
		// Create test directory and file
		rmSync(test_dir, {recursive: true, force: true});
		mkdirSync(test_dir, {recursive: true});
		writeFileSync(test_file, test_content, 'utf8');

		filer = new Filer({
			worker_enabled: false, // Use sync for predictable testing
		});
	});

	afterEach(async () => {
		await filer.dispose();
		rmSync(test_dir, {recursive: true, force: true});
	});

	test('explicit resource loading', async () => {
		await filer.mount([test_dir]);

		const disknode = filer.get_disknode(test_file);

		// Resources should not be loaded initially (undefined means not loaded)
		expect(disknode.contents).toBeUndefined();
		expect(disknode.imports).toBeUndefined();

		// Load resources explicitly
		await disknode.load_contents();
		await disknode.load_imports();

		// Now resources should be available
		expect(disknode.contents).toContain('import {a}');
		expect(disknode.imports).toEqual(new Set(['./a.js', './b.js', './d.js']));
	});

	test('batch resource loading', async () => {
		await filer.mount([test_dir]);

		const disknode = filer.get_disknode(test_file);

		// Use Filer's batch loading
		await filer.load_resources_batch([disknode], {
			contents: true,
			imports: true,
			stats: true,
		});

		// All resources should be loaded
		expect(disknode.contents).toContain('import {a}');
		expect(disknode.imports).toEqual(new Set(['./a.js', './b.js', './d.js']));
		expect(disknode.stats).not.toBeNull();
	});

	test('async parse_imports_async method', async () => {
		const result = await filer.parse_imports_async(test_file, test_content);
		expect(result).toEqual(['./a.js', './b.js', './d.js']);
	});

	test('observer with needs_imports hint', async () => {
		await filer.mount([test_dir]);

		let observer_called = false;
		let observed_disknode: any = null;

		filer.observe({
			id: 'test-observer',
			patterns: [/\.ts$/],
			needs_imports: true,
			on_change: async (batch) => {
				observer_called = true;
				observed_disknode = batch.all_disknodes[0];
			},
		});

		// Trigger a change
		writeFileSync(test_file, test_content + '\n// comment', 'utf8');

		// Wait for observer to be called
		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(observer_called).toBe(true);
		expect(observed_disknode?.imports).toEqual(new Set(['./a.js', './b.js', './d.js']));
	});
});
