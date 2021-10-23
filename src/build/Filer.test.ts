import {suite} from 'uvu';
import * as t from 'uvu/assert';
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

/* test_Filer */
const test_Filer = suite('Filer', suiteContext);
test_Filer.before.each(resetMemoryFs);

test_Filer('basic serve usage', async ({fs}) => {
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
	t.ok(filer);

	await filer.init();

	const a = await filer.findByPath('a.html');
	t.is(a?.id, aId);
	const b = await filer.findByPath('b.svelte');
	t.is(b?.id, bId);
	const c = await filer.findByPath('c/c.svelte.md');
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
	const entryFilename = 'entry.ts';
	const depFilename = 'dep.ts';
	const entryId = `${rootId}/${entryFilename}`;
	const depId = `${rootId}/${depFilename}`;
	await fs.writeFile(
		entryId,
		`import {a} from './${replaceExtension(depFilename, JS_EXTENSION)}'; export {a};`,
		'utf8',
	);
	await fs.writeFile(depId, 'export const a: number = 5;', 'utf8');
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
		// assumes the current working directory -- we could change the test paths to avoid this,
		// but we want to test arbitrary absolute paths,
		// so instead we probably want to make a new pluggable `Filer` option like `paths`,
		// which would make customizable what's currently hardcoded at `src/paths.ts`.
		mapDependencyToSourceId: async (dependency) => {
			return `${rootId}/${replaceExtension(dependency.mappedSpecifier.substring(2), TS_EXTENSION)}`;
		},
	});
	t.ok(filer);
	await filer.init();

	const entryFile = await filer.findByPath(entryFilename);
	t.is(entryFile?.id, entryId);

	const depFile = await filer.findByPath(depFilename);
	t.is(depFile?.id, depId);

	t.equal(Array.from(fs._files.keys()), [
		'/',
		'/a',
		'/a/b',
		'/a/b/src',
		'/a/b/src/entry.ts',
		'/a/b/src/dep.ts',
		'/c',
		'/c/dev',
		'/c/dev/testBuildConfig',
		'/c/dev/testBuildConfig/entry.js',
		'/c/dev/testBuildConfig/entry.js.map',
		'/c/dev/testBuildConfig/dep.js',
		'/c/dev/testBuildConfig/dep.js.map',
		'/c/dev_meta',
		'/c/dev_meta/dep.ts.json',
		'/c/dev_meta/entry.ts.json',
	]);
	t.ok(fs._files.has(entryId));

	filer.close();
});

// TODO more tests

test_Filer.run();
/* /test_Filer */
