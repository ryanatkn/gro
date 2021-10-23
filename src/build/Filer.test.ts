import {suite} from 'uvu';
import * as assert from 'uvu/assert';
import {replaceExtension} from '@feltcoop/felt/util/path.js';

import {Filer} from './Filer.js';
import {fs as memoryFs} from '../fs/memory.js';
import type {MemoryFs} from 'src/fs/memory.js';
import type {BuildConfig} from 'src/build/buildConfig.js';
import {JS_EXTENSION, TS_EXTENSION} from 'src/paths.js';
import {groBuilderDefault} from './groBuilderDefault.js';

interface SuiteContext {
	fs: MemoryFs;
}
const suiteContext: SuiteContext = {fs: memoryFs};
const resetMemoryFs = ({fs}: SuiteContext) => fs._reset();

/* test__Filer */
const test__Filer = suite('Filer', suiteContext);
test__Filer.before.each(resetMemoryFs);

test__Filer('basic serve usage', async ({fs}) => {
	const dev = true;

	const aId = '/served/a.html';
	const bId = '/served/b.svelte';
	const cId = '/served/c/c.svelte.md';

	fs.writeFile(aId, 'a', 'utf8');
	fs.writeFile(bId, 'b', 'utf8');
	fs.writeFile(cId, 'c', 'utf8');

	const filer = new Filer({
		fs,
		dev,
		servedDirs: ['/served'],
		watch: false,
	});
	assert.ok(filer);

	await filer.init();

	const a = await filer.findByPath('a.html');
	assert.is(a?.id, aId);
	const b = await filer.findByPath('b.svelte');
	assert.is(b?.id, bId);
	const c = await filer.findByPath('c/c.svelte.md');
	assert.is(c?.id, cId);

	assert.is(fs._files.size, 6);
	assert.ok(fs._files.has(aId));
	assert.ok(fs._files.has(bId));
	assert.ok(fs._files.has(cId));

	filer.close();
});

test__Filer('basic build usage with no watch', async ({fs}) => {
	const dev = true;
	// TODO add a TypeScript file with a dependency
	const rootId = '/a/b/src';
	const entryFilename = 'entry.ts';
	const dep1Filename = 'dep1.ts';
	const dep2Filename = 'dep2.ts';
	const entryId = `${rootId}/${entryFilename}`;
	const dep1Id = `${rootId}/${dep1Filename}`;
	const dep2Id = `${rootId}/${dep2Filename}`;
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
		dev,
		buildDir: '/c/',
		builder: groBuilderDefault(),
		buildConfigs: [buildConfig],
		sourceDirs: [rootId],
		servedDirs: [rootId], // normally gets served out of the Gro build dirs, but we override
		watch: false,
		// TODO this is hacky to work around the fact that the default implementation of this
		// assumes the current working directory  we could change the test paths to avoid this,
		// but we want to test arbitrary absolute paths,
		// so instead we probably want to make a new pluggable `Filer` option like `paths`,
		// which would make customizable what's currently hardcoded at `src/paths.ts`.
		mapDependencyToSourceId: async (dependency) =>
			`${rootId}/${replaceExtension(dependency.mappedSpecifier.substring(2), TS_EXTENSION)}`,
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

	assert.equal(Array.from(filer.sourceMetaById.entries()), sourceMetaSnapshot);

	const entryFile = await filer.findByPath(entryFilename);
	assert.is(entryFile?.id, entryId);
	const dep1File = await filer.findByPath(dep1Filename);
	assert.is(dep1File?.id, dep1Id);
	const dep2File = await filer.findByPath(dep2Filename);
	assert.is(dep2File?.id, dep2Id);

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

// TODO more tests

test__Filer.run();
/* test__Filer */
