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

	fs.outputFile('/served/a.html', 'a', 'utf8');
	fs.outputFile('/served/b.svelte', 'b', 'utf8');
	fs.outputFile('/served/c.svelte.md', 'c', 'utf8');
	console.log('fs._files', fs._files);

	const filer = new Filer({
		fs,
		dev,
		servedDirs: ['/served'],
		watch: false,
	});
	t.ok(filer);

	// TODO make this work
	// await filer.init();
	// TODO make sure the fs contains and filer loaded what we'd expect from the config (query both exhaustively for internal state)
	t.ok(fs._files.size);

	// filer.close();
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
