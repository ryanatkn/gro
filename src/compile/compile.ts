import swc from '@swc/core';
import {join} from 'path';

import {loadTsconfig} from './tsHelpers.js';
import {
	toSwcCompilerTarget,
	mergeSwcOptions,
	getDefaultSwcOptions,
	addSourceMapFooter,
} from './swcHelpers.js';
import {spawnProcess} from '../utils/process.js';
import {printMs, printPath, printSubTiming} from '../utils/print.js';
import {Logger} from '../utils/log.js';
import {createStopwatch, Timings} from '../utils/time.js';
import {findFiles, outputFile, readFile} from '../fs/nodeFs.js';
import {paths, toBuildId, toSourceMapPath} from '../paths.js';
import {red} from '../colors/terminal.js';

export const compile = async (log: Logger): Promise<void> => {
	log.info('compiling...');

	const totalTiming = createStopwatch();
	const timings = new Timings();
	const logTimings = () => {
		for (const [key, timing] of timings.getAll()) {
			log.trace(printSubTiming(key, timing));
		}
		log.info(`🕒 compiled in ${printMs(totalTiming())}`);
	};

	if (process.env.NODE_ENV === 'production') {
		await spawnProcess('node_modules/.bin/tsc'); // ignore compiler errors
		logTimings();
		return;
	}

	// load all files into memory
	const stopTimingToFindFiles = timings.start('find files');
	const statsByPath = await findFiles(paths.source, ({path}) => path.endsWith('.ts'), null);
	stopTimingToFindFiles();
	const timingToReadFiles = timings.start('read files');
	const codeByPath = new Map<string, string>();
	await Promise.all(
		Array.from(statsByPath.entries()).map(async ([path, stats]) => {
			if (stats.isDirectory()) return;
			const contents = await readFile(join(paths.source, path), 'utf8');
			// console.log('file', path, contents.length);
			codeByPath.set(path, contents);
		}),
	);
	timingToReadFiles();

	// load the options
	const tsconfigPath = undefined; // TODO parameterized options?
	const basePath = undefined; // TODO parameterized options?
	const timingToLoadTsconfig = timings.start('load tsconfig');
	const tsconfig = loadTsconfig(log, tsconfigPath, basePath);
	timingToLoadTsconfig();
	const {compilerOptions} = tsconfig;
	const target = toSwcCompilerTarget(compilerOptions && compilerOptions.target);
	const swcOptions = getDefaultSwcOptions(); // TODO parameterized options?

	const results = new Map<string, string>();

	// compile everything
	const timingToCompile = timings.start('compile');
	await Promise.all(
		Array.from(codeByPath.entries()).map(async ([path, code]) => {
			const finalSwcOptions = mergeSwcOptions(swcOptions, target, path);

			let output: swc.Output;
			try {
				output = await swc.transform(code, finalSwcOptions);
			} catch (err) {
				log.error(red('Failed to transpile TypeScript'), printPath(path));
				throw err;
			}

			const sourceMapPath = toSourceMapPath(path);
			results.set(path, addSourceMapFooter(output.code, sourceMapPath));
			results.set(sourceMapPath, output.map!);
		}),
	);
	timingToCompile();

	// output the compiled files
	const timingToWriteToDisk = timings.start('write to disk');
	await Promise.all(
		Array.from(results.entries()).map(([path, contents]) => outputFile(toBuildId(path), contents)),
	);
	timingToWriteToDisk();

	logTimings();
};
