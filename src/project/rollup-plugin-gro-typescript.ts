import ts from 'typescript';
import {Plugin, PluginContext} from 'rollup';
import {resolve} from 'path';
import {createFilter} from '@rollup/pluginutils';

import {magenta, red} from '../colors/terminal.js';
import {createStopwatch} from '../utils/time.js';
import {SystemLogger, Logger} from '../utils/log.js';
import {printKeyValue, printMs, printPath} from '../utils/print.js';
import {toRootPath, isSourceId, toSourceExt} from '../paths.js';
import {loadTsconfig, logTsDiagnostics} from '../compile/tsHelpers.js';
import {omitUndefined} from '../utils/object.js';

/*

This is not currently being used, but it may be needed for type mappings in production buiilds.

*/

// TODO parallelize with workers?

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
	tsconfigPath: string | undefined;
	basePath: string | undefined;
	reportDiagnostics: boolean;
	ondiagnostics: typeof handleDiagnostics;
	onstats: typeof handleStats;
}
export type InitialOptions = Partial<Options>;
export const initOptions = (opts: InitialOptions): Options => ({
	include: ['*.ts+(|x)', '**/*.ts+(|x)'],
	exclude: ['*.d.ts', '**/*.d.ts'],
	tsconfigPath: undefined,
	basePath: undefined,
	reportDiagnostics: true, // TODO check transpilation times where this is false
	ondiagnostics: handleDiagnostics,
	onstats: handleStats,
	...omitUndefined(opts),
});

export const name = 'gro-typescript';

export const groTypescriptPlugin = (opts: InitialOptions = {}): Plugin => {
	const {
		include,
		exclude,
		tsconfigPath,
		basePath,
		reportDiagnostics,
		ondiagnostics,
		onstats,
	} = initOptions(opts);

	const log = new SystemLogger([magenta(`[${name}]`)]);

	const tsconfig = loadTsconfig(log, tsconfigPath, basePath);
	const {compilerOptions} = tsconfig;

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
			let transpileOutput: ts.TranspileOutput;
			try {
				transpileOutput = ts.transpileModule(code, {
					compilerOptions,
					fileName: id,
					reportDiagnostics,
					// moduleName?: string;
					// renamedDependencies?: Map<string>;
				});
			} catch (err) {
				log.error(red('Failed to transpile TypeScript'), printPath(id));
				throw err;
			}
			const {outputText, sourceMapText, diagnostics} = transpileOutput;

			if (diagnostics) {
				ondiagnostics(id, diagnostics, handleDiagnostics, this, log);
			}

			// TODO improve this - see usage elsewhere too
			const transpileElapsed = stopwatch();
			const stats: Stats = {
				timings: {
					total: transpileElapsed,
					transpile: {total: transpileElapsed},
				},
			};
			onstats(id, stats, handleStats, this, log);

			return {
				code: outputText,
				map: sourceMapText ? JSON.parse(sourceMapText) : null,
			};
		},
	};
};

const handleDiagnostics = (
	_id: string,
	diagnostics: ts.Diagnostic[],
	_handleDiagnostics: (id: string, diagnostics: ts.Diagnostic[], ...args: any[]) => void,
	_pluginContext: PluginContext,
	log: Logger,
): void => {
	logTsDiagnostics(diagnostics, log);
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
