import {suite} from 'uvu';
import * as t from 'uvu/assert';

import {Filer} from './Filer.js';
import {fs as memoryFs} from '../fs/memory.js';
import type {MemoryFs} from '../fs/memory.js';

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
	fs._reset();

	const aId = '/served/a.html';
	const bId = '/served/b.svelte';
	const cId = '/served/c/c.svelte.md';

	fs.outputFile(aId, 'a', 'utf8');
	fs.outputFile(bId, 'b', 'utf8');
	fs.outputFile(cId, 'c', 'utf8');

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

// TODO this is broken
// test_Filer('basic build usage', async ({fs}) => {
// 	const dev = true;
// 	fs._reset();
// const buildConfig: BuildConfig = {
//   name: 'test_build_config',
//   platform: 'node',
//   primary: true,
//   dist: false,
//   input: ['entrypoint.ts'],
// };
// 	const filer = new Filer({
// 		fs,
// 		dev,
// 		builder: createDefaultBuilder(),
// 		sourceDirs: [paths.source],
// 		buildConfigs: [buildConfig],
// 		watch: false,
// 	});
// 	t.ok(filer);
// 	await filer.init();
// 	t.ok(fs._files.size);
// 	filer.close();
// });

// TODO more tests

test_Filer.run();
/* /test_Filer */
