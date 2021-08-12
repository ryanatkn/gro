import {suite} from 'uvu';
import * as t from 'uvu/assert';

import {Filer} from './Filer.js';
import {fs as memoryFs} from '../fs/memory.js';
import type {MemoryFs} from 'src/fs/memory.js';
import type {Builder} from 'src/build/builder.js';
import type {BuildConfig} from 'src/build/build_config.js';

interface SuiteContext {
	fs: MemoryFs;
}
const suite_context: SuiteContext = {fs: memoryFs};
const reset_memory_fs = ({fs}: SuiteContext) => fs._reset();

/* test_Filer */
const test_Filer = suite('Filer', suite_context);
test_Filer.before.each(reset_memory_fs);

test_Filer('basic serve usage', async ({fs}) => {
	const dev = true;

	const aId = '/served/a.html';
	const bId = '/served/b.svelte';
	const cId = '/served/c/c.svelte.md';

	fs.write_file(aId, 'a', 'utf8');
	fs.write_file(bId, 'b', 'utf8');
	fs.write_file(cId, 'c', 'utf8');

	const filer = new Filer({
		fs,
		dev,
		served_dirs: ['/served'],
		watch: false,
	});
	t.ok(filer);

	await filer.init();

	const a = await filer.find_by_path('a.html');
	t.is(a?.id, aId);
	const b = await filer.find_by_path('b.svelte');
	t.is(b?.id, bId);
	const c = await filer.find_by_path('c/c.svelte.md');
	t.is(c?.id, cId);

	t.is(fs._files.size, 6);
	t.ok(fs._files.has(aId));
	t.ok(fs._files.has(bId));
	t.ok(fs._files.has(cId));

	filer.close();
});

test_Filer('basic build usage with no watch', async ({fs}) => {
	const dev = true;
	// TODO add a TypeScript file with a dependency
	const rootId = '/a/b/src';
	const entrypointFilename = 'entrypoint.ts';
	const entryId = `${rootId}/${entrypointFilename}`;
	fs.write_file(entryId, 'export const a: number = 5;', 'utf8');
	const build_config: BuildConfig = {
		name: 'test_build_config',
		platform: 'node',
		input: [entryId],
	};
	const builder: Builder = {
		name: '@feltcoop/gro_builder_test',
		build(_source, _build_config, _ctx) {
			return []; // TODO return a file and verify it below
		},
	};
	const filer = new Filer({
		fs,
		dev,
		build_dir: '/c/',
		builder,
		build_configs: [build_config],
		source_dirs: [rootId],
		served_dirs: [rootId], // normally gets served out of the Gro build dirs, but we override
		watch: false,
	});
	t.ok(filer);
	await filer.init();

	const entryFile = await filer.find_by_path(entrypointFilename);
	t.is(entryFile?.id, entryId);

	t.equal(Array.from(fs._files.keys()), [
		'/',
		'/a',
		'/a/b',
		'/a/b/src',
		'/a/b/src/entrypoint.ts',
		'/c',
		'/c/dev_meta',
		'/c/dev_meta/entrypoint.ts.json',
	]);
	t.ok(fs._files.has(entryId));

	filer.close();
});

// TODO more tests

test_Filer.run();
/* /test_Filer */
