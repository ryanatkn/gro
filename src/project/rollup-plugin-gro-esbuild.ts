import esbuild from 'esbuild';
import {Plugin, PluginContext} from 'rollup';
import {resolve} from 'path';
import {createFilter} from '@rollup/pluginutils';

import {magenta, red} from '../utils/terminal.js';
import {createStopwatch} from '../utils/time.js';
import {SystemLogger, Logger} from '../utils/log.js';
import {printKeyValue, printMs, printPath} from '../utils/print.js';
import {toRootPath, isSourceId, TS_EXTENSION} from '../paths.js';
import {omitUndefined} from '../utils/object.js';
import {replaceExtension} from '../utils/path.js';

// TODO improve along with Svelte compile stats
interface Stats {
	timings: {
		total: number;
		transpile?: {total: number};
	};
}

const MATCH_JS_IMPORT = /^\.?\.\/.*\.js$/;

export interface Options {
	esbuildOptions: esbuild.TransformOptions;
	include: string | RegExp | (string | RegExp)[] | null;
	exclude: string | RegExp | (string | RegExp)[] | null;
	onstats: typeof handleStats;
}
export type RequiredOptions = 'esbuildOptions';
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => ({
	include: ['*.ts', '**/*.ts'],
	exclude: ['*.d.ts', '**/*.d.ts'],
	onstats: handleStats,
	...omitUndefined(opts),
});

export const name = 'gro-esbuild';

export const groEsbuildPlugin = (opts: InitialOptions): Plugin => {
	const {include, exclude, esbuildOptions, onstats} = initOptions(opts);

	const log = new SystemLogger([magenta(`[${name}]`)]);

	const filter = createFilter(include, exclude);

	return {
		name,
		resolveId(importee, importer) {
			// TypeScript doesn't allow importing `.ts` files right now.
			// See https://github.com/microsoft/TypeScript/issues/38149
			// This ensures that `.js` files are imported correctly from TypeScript.
			if (importer && MATCH_JS_IMPORT.test(importee)) {
				const resolvedPath = resolve(importer, '../', importee);
				if (isSourceId(resolvedPath)) {
					return replaceExtension(resolvedPath, TS_EXTENSION);
				}
			}
			return null;
		},
		async transform(code, id) {
			if (!filter(id)) return null;

			const stopwatch = createStopwatch();

			log.trace('transpile', printPath(id));
			let output: esbuild.TransformResult;
			try {
				// TODO do we need to add `sourcefile` to `esbuildOptions` for sourcemaps?
				// currently not seeing a difference in the output
				output = await esbuild.transform(code, esbuildOptions);
			} catch (err) {
				log.error(red('Failed to transpile TypeScript'), printPath(id));
				throw err;
			}

			// TODO improve this - see usage elsewhere too - it's only written this way to match Svelte's format
			const transpileElapsed = stopwatch();
			const stats: Stats = {
				timings: {
					total: transpileElapsed,
					transpile: {total: transpileElapsed},
				},
			};
			onstats(id, stats, handleStats, this, log);

			return output;
		},
	};
};

const handleStats = (
	id: string,
	stats: Stats,
	_handleStats: (id: string, stats: Stats, ...args: any[]) => void,
	_pluginContext: PluginContext,
	log: Logger,
): void => {
	log.info(
		printKeyValue('stats', toRootPath(id)),
		...[
			// printKeyValue('total', printMs(stats.timings.total)),
			stats.timings.transpile && printKeyValue('transpile', printMs(stats.timings.transpile.total)),
		].filter(Boolean),
	);
};
