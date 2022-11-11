import {suite} from 'uvu';
import * as assert from 'uvu/assert';
import {replaceExtension} from '@feltcoop/util';

import {Filer} from './Filer.js';
import {fs as memoryFs, type MemoryFs} from '../fs/memory.js';
import type {BuildConfig} from './buildConfig.js';
import {createPaths, JS_EXTENSION} from '../paths.js';
import {groBuilderDefault} from './groBuilderDefault.js';

interface SuiteContext {
	fs: MemoryFs;
}
const suiteContext: SuiteContext = {fs: memoryFs};
const resetMemoryFs = ({fs}: SuiteContext) => fs._reset();

/* test__Filer */
const test__Filer = suite('Filer', suiteContext);
test__Filer.before.each(resetMemoryFs);

test__Filer('basic build usage with no watch', async ({fs}) => {
	const buildDir = '/c/';
	const rootId = '/a/b';
	const paths = createPaths(rootId);
	const entryFilename = 'entry.ts';
	const dep1Filename = 'dep1.ts';
	const dep2Filename = 'dep2.ts';
	const entryId = paths.source + entryFilename;
	const dep1Id = paths.source + dep1Filename;
	const dep2Id = paths.source + dep2Filename;
	await fs.writeFile(
		entryId,
		`import {a} from './${replaceExtension(dep1Filename, JS_EXTENSION)}'; export {a};`,
		'utf8',
	);
	await fs.writeFile(
		dep1Id,
		`import {a} from './${replaceExtension(dep2Filename, JS_EXTENSION)}'; export {a};`,
		'utf8',
	);
	await fs.writeFile(dep2Id, 'export const a: number = 5;', 'utf8');
	const buildConfig: BuildConfig = {
		name: 'testBuildConfig',
		platform: 'node',
		input: [entryId],
	};
	const filer = new Filer({
		fs,
		paths,
		buildDir,
		builder: groBuilderDefault(),
		buildConfigs: [buildConfig],
		sourceDirs: [paths.source],
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

	// snapshot test the entire sourceMeta
	assert.equal(Array.from(filer.sourceMetaById.entries()), sourceMetaSnapshot);

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

const sourceMetaSnapshot = [
	[
		'/a/b/src/dep2.ts',
		{
			cacheId: '/c/dev_meta/dep2.ts.json',
			data: {
				sourceId: '/a/b/src/dep2.ts',
				contentHash: '8658aba51e656a918d4768bfbd6cdbf1',
				builds: [
					{
						id: '/c/dev/testBuildConfig/dep2.js',
						buildName: 'testBuildConfig',
						dependencies: null,
						encoding: 'utf8',
					},
					{
						id: '/c/dev/testBuildConfig/dep2.js.map',
						buildName: 'testBuildConfig',
						dependencies: null,
						encoding: 'utf8',
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
				sourceId: '/a/b/src/dep1.ts',
				contentHash: '5f8c0c9016e8afd8b9575889a9e9226b',
				builds: [
					{
						id: '/c/dev/testBuildConfig/dep1.js',
						buildName: 'testBuildConfig',
						dependencies: [
							{
								specifier: './dep2.js',
								mappedSpecifier: './dep2.js',
								originalSpecifier: './dep2.js',
								buildId: '/c/dev/testBuildConfig/dep2.js',
								external: false,
							},
						],
						encoding: 'utf8',
					},
					{
						id: '/c/dev/testBuildConfig/dep1.js.map',
						buildName: 'testBuildConfig',
						dependencies: null,
						encoding: 'utf8',
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
				sourceId: '/a/b/src/entry.ts',
				contentHash: '216225ec7cebcb5c2cf443df2050b2a0',
				builds: [
					{
						id: '/c/dev/testBuildConfig/entry.js',
						buildName: 'testBuildConfig',
						dependencies: [
							{
								specifier: './dep1.js',
								mappedSpecifier: './dep1.js',
								originalSpecifier: './dep1.js',
								buildId: '/c/dev/testBuildConfig/dep1.js',
								external: false,
							},
						],
						encoding: 'utf8',
					},
					{
						id: '/c/dev/testBuildConfig/entry.js.map',
						buildName: 'testBuildConfig',
						dependencies: null,
						encoding: 'utf8',
					},
				],
			},
		},
	],
];

test__Filer('multiple build configs', async ({fs}) => {
	const buildDir = '/c/';
	const rootId = '/a/b';
	const paths = createPaths(rootId);
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
		`import {a} from './${replaceExtension(dep1Filename, JS_EXTENSION)}';
		export {a};`,
		'utf8',
	);
	await fs.writeFile(
		entry2Id,
		`import {a} from './${replaceExtension(dep1Filename, JS_EXTENSION)}';
		import {b} from './${replaceExtension(dep3Filename, JS_EXTENSION)}';
		export {a, b};`,
		'utf8',
	);
	await fs.writeFile(
		dep1Id,
		`import {a} from './${replaceExtension(dep2Filename, JS_EXTENSION)}';
		export {a};`,
		'utf8',
	);
	await fs.writeFile(dep2Id, 'export const a: number = 5;', 'utf8');
	await fs.writeFile(dep3Id, 'export const b: number = 5;', 'utf8');
	const buildConfig1: BuildConfig = {
		name: 'testBuildConfig',
		platform: 'node',
		input: [entry1Id],
	};
	const buildConfig2: BuildConfig = {
		name: 'testBuildConfig',
		platform: 'node',
		input: [entry2Id],
	};

	const filerOptions = {
		fs,
		paths,
		buildDir,
		builder: groBuilderDefault(),
		sourceDirs: [paths.source],
		watch: false,
	};

	// filer1 has the first build config
	const filer1 = new Filer({
		...filerOptions,
		buildConfigs: [buildConfig1],
	});
	assert.ok(filer1);
	await filer1.init();
	assert.is(filer1.sourceMetaById.size, 3);
	assert.is(fs._files.size, 22);
	assert.ok(fs._files.has(entry1Id));
	filer1.close();

	// filer2 has the second build config
	const filer2 = new Filer({
		...filerOptions,
		buildConfigs: [buildConfig2],
	});
	assert.ok(filer2);
	await filer2.init();
	assert.is(filer2.sourceMetaById.size, 5);
	assert.is(fs._files.size, 28);
	assert.ok(fs._files.has(entry2Id));
	filer2.close();

	// load filer1 again, and make sure it loads only the necessary source meta
	const filer1B = new Filer({
		...filerOptions,
		buildConfigs: [buildConfig1],
	});
	assert.ok(filer1B);
	await filer1B.init();
	assert.is(filer1B.sourceMetaById.size, 5); // TODO should be `3` after changing it to lazy load
	assert.is(fs._files.size, 28);
	filer1B.close();

	// filer3 has both build configs
	const filer3 = new Filer({
		...filerOptions,
		buildConfigs: [buildConfig1, buildConfig2],
	});
	assert.ok(filer3);
	await filer3.init();
	assert.is(filer3.sourceMetaById.size, 5);
	assert.is(fs._files.size, 28);
	filer3.close();

	// load filer1 again after deleting a source file dependency
	await fs.remove(dep3Id);
	const filer1C = new Filer({
		...filerOptions,
		buildConfigs: [buildConfig1],
	});
	assert.ok(filer1C);
	await filer1C.init();
	assert.is(filer1C.sourceMetaById.size, 4);
	assert.is(fs._files.size, 26);
	filer1C.close();

	// load filer2 again with its still-deleted dependency
	const filer2B = new Filer({
		...filerOptions,
		buildConfigs: [buildConfig2],
	});
	assert.ok(filer2B);
	await filer2B.init();
	assert.is(filer2B.sourceMetaById.size, 4);
	assert.is(fs._files.size, 26);
	filer2B.close();

	// load filer2 again after recreating its previously deleted source file
	await fs.writeFile(dep3Id, 'export const b: number = 5;', 'utf8');
	const filer2C = new Filer({
		...filerOptions,
		buildConfigs: [buildConfig2],
	});
	assert.ok(filer2C);
	await filer2C.init();
	assert.is(filer2C.sourceMetaById.size, 5);
	assert.is(fs._files.size, 28);
	filer2C.close();
});

test__Filer.run();
/* test__Filer */
