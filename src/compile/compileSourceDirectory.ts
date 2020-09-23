import {join} from 'path';

import {spawnProcess} from '../utils/process.js';
import {printMs, printPath, printTiming} from '../utils/print.js';
import {Logger} from '../utils/log.js';
import {createStopwatch, Timings} from '../utils/time.js';
import {findFiles, outputFile, readFile} from '../fs/nodeFs.js';
import {paths, toBuildId, toSourceMapPath} from '../paths.js';
import {red} from '../colors/terminal.js';
import {CompiledOutput, createCompileFile} from './compileFile.js';

export const compileSourceDirectory = async (log: Logger): Promise<void> => {
	log.info('compiling...');

	const totalTiming = createStopwatch();
	const timings = new Timings();
	const logTimings = () => {
		for (const [key, timing] of timings.getAll()) {
			log.trace(printTiming(key, timing));
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
	const codeBySourceId = new Map<string, string>();
	await Promise.all(
		Array.from(statsByPath.entries()).map(async ([path, stats]) => {
			if (stats.isDirectory()) return;
			const id = join(paths.source, path);
			const contents = await readFile(id, 'utf8');
			codeBySourceId.set(id, contents);
		}),
	);
	timingToReadFiles();

	const results = new Map<string, string>();

	const timingToSetupCompiler = timings.start('setup compiler');
	const compileFile = createCompileFile(log);
	timingToSetupCompiler();

	// compile everything
	const timingToCompile = timings.start('compile');
	await Promise.all(
		Array.from(codeBySourceId.entries()).map(async ([id, code]) => {
			let output: CompiledOutput;
			try {
				output = await compileFile(id, code);
			} catch (err) {
				log.error(red('Failed to transpile TypeScript'), printPath(id));
				throw err;
			}

			results.set(id, output.code);
			if (output.map !== undefined) {
				// TODO see `GenFile` interface when we add Svelte support,
				// we should unify things here that works for both source map files and Svelte files like css
				results.set(toSourceMapPath(id), output.map!);
			}
		}),
	);
	timingToCompile();

	// output the compiled files
	const timingToWriteToDisk = timings.start('write to disk');
	await Promise.all(
		Array.from(results.entries()).map(([id, contents]) => outputFile(toBuildId(id), contents)),
	);
	timingToWriteToDisk();

	logTimings();
};
