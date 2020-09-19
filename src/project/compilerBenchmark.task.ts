import swc from '@swc/core';
import ts from 'typescript';
import {join} from 'path';

import {Task} from '../task/task.js';
import {loadTsconfig} from '../compile/tsHelpers.js';
import {findFiles, readFile, outputFile} from '../fs/nodeFs.js';
import {paths} from '../paths.js';
import {printMs} from '../utils/print.js';
import {Timings} from '../utils/time.js';

/*

This is a benchmark comparing transpilation speed of the official TypeScript compiler and `swc`.
I'm not including `esbuild` for now because it always strips unused imports,
which makes it unsuitable as a Svelte preprocessor.
I'd like to revisit this if the API adds support for transpile-only behavior like swc and tsc.

Results:

➤ [project/compilerBenchmark:log] tscTranspileOnly ...
➤ [project/compilerBenchmark:log] 🕒 tscTranspileOnly 1905.0ms
➤ [project/compilerBenchmark:log] swcSync ...
➤ [project/compilerBenchmark:log] 🕒 swcSync 58.7ms
➤ [project/compilerBenchmark:log] swcAsync ...
➤ [project/compilerBenchmark:log] 🕒 swcAsync 87.6ms
➤ [project/compilerBenchmark:log] swcParallel ...
➤ [project/compilerBenchmark:log] 🕒 swcParallel 17.4ms

Conclusion: use `swc` instead. lol. Start with the Svelte preprocessor.

Notes:

`swc` doesn't seem to add the sourcemap footer and I don't see an option.
```
//# sourceMappingURL=foo.js.map
```

*/

// TODO maybe add source maps?

export const task: Task = {
	description: 'benchmark compilation with different libraries',
	run: async ({log}) => {
		// load all files into memory
		log.info('loading files');
		const statsByPath = await findFiles(paths.source, ({path}) => path.endsWith('.ts'), null);
		const codeByPath = new Map<string, string>();
		for (const [path, stats] of statsByPath) {
			if (stats.isDirectory()) continue;
			const contents = await readFile(join(paths.source, path), 'utf8');
			// console.log('file', path, contents.length);
			codeByPath.set(path, contents);
		}

		const timings = new Timings();

		const tsconfig = loadTsconfig(log);
		const {compilerOptions} = tsconfig;

		const testFile = 'utils/json.ts';
		const writeTestFile = async (suffix: string, contents: string, map = false) => {
			await outputFile(`src/${testFile}.${suffix}.js${map ? '.map' : ''}`, contents);
		};
		const startBenchmark = (name: string) => {
			log.info(name, '...');
			timings.start(name);
			return async (resultsByPath: Map<string, string>) => {
				log.info(`🕒 ${name} ${printMs(timings.stop(name))}`);
				await writeTestFile(name, resultsByPath.get(testFile)!);
				await writeTestFile(name, resultsByPath.get(`${testFile}.map`)!, true);
			};
		};

		// tsc transpileOnly
		const tscTranspileOnlyResults = new Map<string, string>();
		const endTscTranspileOnlyBenchmark = startBenchmark('tscTranspileOnly');
		for (const [path, code] of codeByPath) {
			const result = ts.transpileModule(code, {
				compilerOptions,
				fileName: path,
				// reportDiagnostics,
				// moduleName?: string;
				// renamedDependencies?: Map<string>;
			});
			tscTranspileOnlyResults.set(path, result.outputText);
			tscTranspileOnlyResults.set(`${path}.map`, result.sourceMapText!);
		}
		await endTscTranspileOnlyBenchmark(tscTranspileOnlyResults);

		// swcSync
		const swcSyncResults = new Map<string, string>();
		const endSwcSyncBenchmark = startBenchmark('swcSync');
		for (const [path, code] of codeByPath) {
			const result = swc.transformSync(code, {
				filename: path,
				sourceMaps: true,
				jsc: {
					parser: {syntax: 'typescript', tsx: false, decorators: false, dynamicImport: true},
					target: 'es2019',
					loose: true,
				},
			});
			swcSyncResults.set(path, result.code);
			swcSyncResults.set(`${path}.map`, result.map!);
		}
		endSwcSyncBenchmark(swcSyncResults);

		// swc async
		const swcAsyncResults = new Map<string, string>();
		const endSwcAsyncBenchmark = startBenchmark('swcAsync');
		for (const [path, code] of codeByPath) {
			const result = await swc.transform(code, {
				filename: path,
				sourceMaps: true,
				jsc: {
					parser: {syntax: 'typescript', tsx: false, decorators: false, dynamicImport: true},
					target: 'es2019',
					loose: true,
				},
			});
			swcAsyncResults.set(path, result.code);
			swcAsyncResults.set(`${path}.map`, result.map!);
		}
		endSwcAsyncBenchmark(swcAsyncResults);

		// swcParallel
		const swcParallelResults = new Map<string, string>();
		const endSwcParallelBenchmark = startBenchmark('swcParallel');
		await Promise.all(
			Array.from(codeByPath.entries()).map(async ([path, code]) => {
				const result = await swc.transform(code, {
					filename: path,
					sourceMaps: true,
					jsc: {
						parser: {syntax: 'typescript', tsx: false, decorators: false, dynamicImport: true},
						target: 'es2019',
						loose: true,
					},
				});
				swcParallelResults.set(path, result.code);
				swcParallelResults.set(`${path}.map`, result.map!);
			}),
		);
		endSwcParallelBenchmark(swcParallelResults);
	},
};
