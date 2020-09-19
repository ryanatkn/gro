import swc from '@swc/core';
import {Plugin, PluginContext} from 'rollup';
import {resolve} from 'path';
import {createFilter} from '@rollup/pluginutils';

import {getDefaultSwcOptions, mergeSwcOptions, toSwcCompilerTarget} from '../compile/swcHelpers.js';
import {magenta, red} from '../colors/terminal.js';
import {createStopwatch} from '../utils/time.js';
import {SystemLogger, Logger} from '../utils/log.js';
import {printKeyValue, printMs, printPath} from '../utils/print.js';
import {toRootPath, isSourceId, toSourceExt} from '../paths.js';
import {loadTsconfig} from '../compile/tsHelpers.js';
import {omitUndefined} from '../utils/object.js';

// TODO improve along with Svelte compile stats
interface Stats {
	timings: {
		total: number;
		transpile?: {total: number};
	};
}

export interface Options {
	include: string | RegExp | (string | RegExp)[] | null;
	exclude: string | RegExp | (string | RegExp)[] | null;
	swcOptions: swc.Options;
	tsconfigPath: string | undefined;
	basePath: string | undefined;
	onstats: typeof handleStats;
}
export type InitialOptions = Partial<Options>;
export const initOptions = (opts: InitialOptions): Options => ({
	include: ['*.ts+(|x)', '**/*.ts+(|x)'],
	exclude: ['*.d.ts', '**/*.d.ts'],
	swcOptions: getDefaultSwcOptions(),
	tsconfigPath: undefined,
	basePath: undefined,
	onstats: handleStats,
	...omitUndefined(opts),
});

export const name = 'gro-swc';

export const groSwcPlugin = (opts: InitialOptions = {}): Plugin => {
	const {include, exclude, swcOptions, tsconfigPath, basePath, onstats} = initOptions(opts);

	const log = new SystemLogger([magenta(`[${name}]`)]);

	const tsconfig = loadTsconfig(log, tsconfigPath, basePath);
	const {compilerOptions} = tsconfig;
	const target = toSwcCompilerTarget(compilerOptions && compilerOptions.target);

	const filter = createFilter(include, exclude);

	return {
		name,
		resolveId(importee, importer) {
			// TypeScript doesn't allow importing `.ts` files right now.
			// See https://github.com/microsoft/TypeScript/issues/38149
			// This ensures that `.js` files are imported correctly from TypeScript.
			// Note that detection of the relative `importee` does not strictly follow conventions
			// by allowing dot-free relative paths - this is an acceptable limitation for now.
			if (importer && importee.endsWith('.js') && importee.startsWith('.')) {
				const resolvedPath = resolve(importer, '../', importee);
				if (isSourceId(resolvedPath)) {
					return toSourceExt(resolvedPath);
				}
			}
			return null;
		},
		async transform(code, id) {
			if (!filter(id)) return null;

			const stopwatch = createStopwatch();

			log.trace('transpile', printPath(id));
			let output: swc.Output;
			try {
				// TODO keep this async, right?
				const finalSwcOptions = mergeSwcOptions(swcOptions, target, id);
				output = await swc.transform(code, finalSwcOptions);
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
