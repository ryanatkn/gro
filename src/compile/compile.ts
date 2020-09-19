import swc from '@swc/core';
import {join} from 'path';

import {loadTsconfig} from './tsHelpers.js';
import {toSwcCompilerTarget, mergeSwcOptions, getDefaultSwcOptions} from './swcHelpers.js';
import {spawnProcess} from '../utils/process.js';
import {printMs, printPath, printSubTiming} from '../utils/print.js';
import {Logger} from '../utils/log.js';
import {Timings} from '../utils/time.js';
import {findFiles, outputFile, readFile} from '../fs/nodeFs.js';
import {paths, toBuildId} from '../paths.js';
import {red} from '../colors/terminal.js';

export const compile = async (log: Logger): Promise<void> => {
	log.info('compiling...');

	const timings = new Timings<'total'>();
	timings.start('total');
	const subTimings = new Timings();
	const logTimings = () => {
		for (const [key, timing] of subTimings.getAll()) {
			log.trace(printSubTiming(key, timing));
		}
		log.info(`🕒 compiled in ${printMs(timings.stop('total'))}`);
	};

	if (process.env.NODE_ENV === 'production') {
		await spawnProcess('node_modules/.bin/tsc'); // ignore compiler errors
		logTimings();
		return;
	}

	// load all files into memory
	subTimings.start('find files');
	const statsByPath = await findFiles(paths.source, ({path}) => path.endsWith('.ts'), null);
	subTimings.stop('find files');
	subTimings.start('read files');
	const codeByPath = new Map<string, string>();
	await Promise.all(
		Array.from(statsByPath.entries()).map(async ([path, stats]) => {
			if (stats.isDirectory()) return;
			const contents = await readFile(join(paths.source, path), 'utf8');
			// console.log('file', path, contents.length);
			codeByPath.set(path, contents);
		}),
	);
	subTimings.stop('read files');

	// load the options
	const tsconfigPath = undefined; // TODO parameterized options?
	const basePath = undefined; // TODO parameterized options?
	subTimings.start('load tsconfig');
	const tsconfig = loadTsconfig(log, tsconfigPath, basePath);
	subTimings.stop('load tsconfig');
	const {compilerOptions} = tsconfig;
	const target = toSwcCompilerTarget(compilerOptions && compilerOptions.target);
	const swcOptions = getDefaultSwcOptions(); // TODO parameterized options?

	const results = new Map<string, string>();

	// compile everything
	subTimings.start('compile');
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

			results.set(path, output.code);
			results.set(`${path}.map`, output.map!);
		}),
	);
	subTimings.stop('compile');

	// output the compiled files
	subTimings.start('write to disk');
	await Promise.all(
		Array.from(results.entries()).map(([path, contents]) => outputFile(toBuildId(path), contents)),
	);
	subTimings.stop('write to disk');

	logTimings();
};
