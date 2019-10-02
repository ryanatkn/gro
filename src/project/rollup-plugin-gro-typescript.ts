import ts from 'typescript';
import {Plugin, PluginContext} from 'rollup';
import rollupPluginutils from 'rollup-pluginutils';
const {createFilter} = rollupPluginutils; // TODO esm

import {magenta, red} from '../colors/terminal.js';
import {createStopwatch} from '../utils/time.js';
import {LogLevel, logger, Logger} from '../utils/log.js';
import {fmtVal, fmtMs, fmtPath} from '../utils/fmt.js';
import {toRootPath} from '../paths.js';
import {loadTsconfig, logTsDiagnostics} from './tsHelpers.js';
import {omitUndefined} from '../utils/object.js';

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
	logLevel: LogLevel;
	ondiagnostics: typeof handleDiagnostics;
	onstats: typeof handleStats;
}
export type RequiredOptions = never;
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => ({
	include: ['*.ts+(|x)', '**/*.ts+(|x)'],
	exclude: ['*.d.ts', '**/*.d.ts'],
	tsconfigPath: undefined,
	basePath: undefined,
	reportDiagnostics: true, // TODO check transpilation times where this is false
	logLevel: LogLevel.Info,
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
		logLevel,
		ondiagnostics,
		onstats,
	} = initOptions(opts);

	const log = logger(logLevel, [magenta(`[${name}]`)]);
	const {error, trace} = log;

	const tsconfig = loadTsconfig(log, tsconfigPath, basePath);
	const {compilerOptions} = tsconfig;

	const filter = createFilter(include, exclude);

	return {
		name,
		async transform(code, id) {
			if (!filter(id)) return null;

			const stopwatch = createStopwatch();

			trace('transpile', fmtPath(id));
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
				error(red('Failed to transpile TypeScript'), fmtPath(id));
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
	_handleDiagnostics: (
		id: string,
		diagnostics: ts.Diagnostic[],
		...args: any[]
	) => void,
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
	{info}: Logger,
): void => {
	info(
		fmtVal('stats', toRootPath(id)),
		...[
			// fmtVal('total', fmtMs(stats.timings.total)),
			stats.timings.transpile &&
				fmtVal('transpile', fmtMs(stats.timings.transpile.total)),
		].filter(Boolean),
	);
};
