import {suite} from 'uvu';
import * as assert from 'uvu/assert';

import {Filer} from './Filer.js';
import {fs as memoryFs, type MemoryFs} from '../fs/memory.js';
import type {BuildConfig} from './build_config.js';
import {create_paths, JS_EXTENSION, replace_extension} from '../path/paths.js';
import {gro_builder_default} from './gro_builder_default.js';

interface SuiteContext {
	fs: MemoryFs;
}
const suiteContext: SuiteContext = {fs: memoryFs};
const resetMemoryFs = ({fs}: SuiteContext) => fs._reset();

/* test__Filer */
const test__Filer = suite('Filer', suiteContext);
test__Filer.before.each(resetMemoryFs);

test__Filer('basic build usage with no watch', async ({fs}) => {
	const build_dir = '/c/';
	const rootId = '/a/b';
	const paths = create_paths(rootId);
	const entryFilename = 'entry.ts';
	const dep1Filename = 'dep1.ts';
	const dep2Filename = 'dep2.ts';
	const entryId = paths.source + entryFilename;
	const dep1Id = paths.source + dep1Filename;
	const dep2Id = paths.source + dep2Filename;
	await fs.writeFile(
		entryId,
		`import {a} from './${replace_extension(dep1Filename, JS_EXTENSION)}'; export {a};`,
		'utf8',
	);
	await fs.writeFile(
		dep1Id,
		`import {a} from './${replace_extension(dep2Filename, JS_EXTENSION)}'; export {a};`,
		'utf8',
	);
	await fs.writeFile(dep2Id, 'export const a: number = 5;', 'utf8');
	const build_config: BuildConfig = {
		name: 'testBuildConfig',
		input: [entryId],
	};
	const filer = new Filer({
		fs,
		paths,
		build_dir,
		builder: gro_builder_default(),
		build_configs: [build_config],
		source_dirs: [paths.source],
		watch: false,
	});
	assert.ok(filer);
	await filer.init();

	// disallow calling `filer.init()` more than once
	// TODO use `assert.rejects` when it lands: https://github.com/lukeed/uvu/pull/132
	let initError;
	try {
		await filer.init();
	} catch (err) {
		initError = err;
	}
	assert.ok(initError);

	// snapshot test the entire source_meta
	assert.equal(Array.from(filer.source_meta_by_id.entries()), source_metaSnapshot);

	assert.equal(Array.from(fs._files.keys()), filesKeysSnapshot);
	assert.ok(fs._files.has(entryId));

	filer.close();
});

const filesKeysSnapshot = [
	'/',
	'/a',
	'/a/b',
	'/a/b/src',
	'/a/b/src/entry.ts',
	'/a/b/src/dep1.ts',
	'/a/b/src/dep2.ts',
	'/c',
	'/c/dev',
	'/c/dev/testBuildConfig',
	'/c/dev/testBuildConfig/entry.js',
	'/c/dev/testBuildConfig/entry.js.map',
	'/c/dev/testBuildConfig/dep1.js',
	'/c/dev/testBuildConfig/dep1.js.map',
	'/c/dev/testBuildConfig/dep2.js',
	'/c/dev/testBuildConfig/dep2.js.map',
	'/c/dev_meta',
	'/c/dev_meta/dep2.ts.json',
	'/c/dev_meta/dep1.ts.json',
	'/c/dev_meta/entry.ts.json',
];

const source_metaSnapshot = [
	[
		'/a/b/src/dep2.ts',
		{
			cacheId: '/c/dev_meta/dep2.ts.json',
			data: {
				source_id: '/a/b/src/dep2.ts',
				content_hash: '8658aba51e656a918d4768bfbd6cdbf1',
				builds: [
					{
						id: '/c/dev/testBuildConfig/dep2.js',
						buildName: 'testBuildConfig',
						dependencies: null,
					},
					{
						id: '/c/dev/testBuildConfig/dep2.js.map',
						buildName: 'testBuildConfig',
						dependencies: null,
					},
				],
			},
		},
	],
	[
		'/a/b/src/dep1.ts',
		{
			cacheId: '/c/dev_meta/dep1.ts.json',
			data: {
				source_id: '/a/b/src/dep1.ts',
				content_hash: '5f8c0c9016e8afd8b9575889a9e9226b',
				builds: [
					{
						id: '/c/dev/testBuildConfig/dep1.js',
						buildName: 'testBuildConfig',
						dependencies: [
							{
								specifier: './dep2.js',
								mapped_specifier: './dep2.js',
								original_specifier: './dep2.js',
								build_id: '/c/dev/testBuildConfig/dep2.js',
								external: false,
							},
						],
					},
					{
						id: '/c/dev/testBuildConfig/dep1.js.map',
						buildName: 'testBuildConfig',
						dependencies: null,
					},
				],
			},
		},
	],
	[
		'/a/b/src/entry.ts',
		{
			cacheId: '/c/dev_meta/entry.ts.json',
			data: {
				source_id: '/a/b/src/entry.ts',
				content_hash: '216225ec7cebcb5c2cf443df2050b2a0',
				builds: [
					{
						id: '/c/dev/testBuildConfig/entry.js',
						buildName: 'testBuildConfig',
						dependencies: [
							{
								specifier: './dep1.js',
								mapped_specifier: './dep1.js',
								original_specifier: './dep1.js',
								build_id: '/c/dev/testBuildConfig/dep1.js',
								external: false,
							},
						],
					},
					{
						id: '/c/dev/testBuildConfig/entry.js.map',
						buildName: 'testBuildConfig',
						dependencies: null,
					},
				],
			},
		},
	],
];

test__Filer('multiple build configs', async ({fs}) => {
	const build_dir = '/c/';
	const rootId = '/a/b';
	const paths = create_paths(rootId);
	const entry1Filename = 'entry1.ts';
	const entry2Filename = 'entry2.ts';
	const dep1Filename = 'dep1.ts';
	const dep2Filename = 'dep2.ts';
	const dep3Filename = 'dep3.ts';
	const entry1Id = paths.source + entry1Filename;
	const entry2Id = paths.source + entry2Filename;
	const dep1Id = paths.source + dep1Filename;
	const dep2Id = paths.source + dep2Filename;
	const dep3Id = paths.source + dep3Filename;
	await fs.writeFile(
		entry1Id,
		`import {a} from './${replace_extension(dep1Filename, JS_EXTENSION)}';
		export {a};`,
		'utf8',
	);
	await fs.writeFile(
		entry2Id,
		`import {a} from './${replace_extension(dep1Filename, JS_EXTENSION)}';
		import {b} from './${replace_extension(dep3Filename, JS_EXTENSION)}';
		export {a, b};`,
		'utf8',
	);
	await fs.writeFile(
		dep1Id,
		`import {a} from './${replace_extension(dep2Filename, JS_EXTENSION)}';
		export {a};`,
		'utf8',
	);
	await fs.writeFile(dep2Id, 'export const a: number = 5;', 'utf8');
	await fs.writeFile(dep3Id, 'export const b: number = 5;', 'utf8');
	const build_config1: BuildConfig = {
		name: 'testBuildConfig',
		input: [entry1Id],
	};
	const build_config2: BuildConfig = {
		name: 'testBuildConfig',
		input: [entry2Id],
	};

	const filerOptions = {
		fs,
		paths,
		build_dir,
		builder: gro_builder_default(),
		source_dirs: [paths.source],
		watch: false,
	};

	// filer1 has the first build config
	const filer1 = new Filer({
		...filerOptions,
		build_configs: [build_config1],
	});
	assert.ok(filer1);
	await filer1.init();
	assert.is(filer1.source_meta_by_id.size, 3);
	assert.is(fs._files.size, 22);
	assert.ok(fs._files.has(entry1Id));
	filer1.close();

	// filer2 has the second build config
	const filer2 = new Filer({
		...filerOptions,
		build_configs: [build_config2],
	});
	assert.ok(filer2);
	await filer2.init();
	assert.is(filer2.source_meta_by_id.size, 5);
	assert.is(fs._files.size, 28);
	assert.ok(fs._files.has(entry2Id));
	filer2.close();

	// load filer1 again, and make sure it loads only the necessary source meta
	const filer1B = new Filer({
		...filerOptions,
		build_configs: [build_config1],
	});
	assert.ok(filer1B);
	await filer1B.init();
	assert.is(filer1B.source_meta_by_id.size, 5); // TODO should be `3` after changing it to lazy load
	assert.is(fs._files.size, 28);
	filer1B.close();

	// filer3 has both build configs
	const filer3 = new Filer({
		...filerOptions,
		build_configs: [build_config1, build_config2],
	});
	assert.ok(filer3);
	await filer3.init();
	assert.is(filer3.source_meta_by_id.size, 5);
	assert.is(fs._files.size, 28);
	filer3.close();

	// load filer1 again after deleting a source file dependency
	await fs.remove(dep3Id);
	const filer1C = new Filer({
		...filerOptions,
		build_configs: [build_config1],
	});
	assert.ok(filer1C);
	await filer1C.init();
	assert.is(filer1C.source_meta_by_id.size, 4);
	assert.is(fs._files.size, 26);
	filer1C.close();

	// load filer2 again with its still-deleted dependency
	const filer2B = new Filer({
		...filerOptions,
		build_configs: [build_config2],
	});
	assert.ok(filer2B);
	await filer2B.init();
	assert.is(filer2B.source_meta_by_id.size, 4);
	assert.is(fs._files.size, 26);
	filer2B.close();

	// load filer2 again after recreating its previously deleted source file
	await fs.writeFile(dep3Id, 'export const b: number = 5;', 'utf8');
	const filer2C = new Filer({
		...filerOptions,
		build_configs: [build_config2],
	});
	assert.ok(filer2C);
	await filer2C.init();
	assert.is(filer2C.source_meta_by_id.size, 5);
	assert.is(fs._files.size, 28);
	filer2C.close();
});

test__Filer.run();
/* test__Filer */
