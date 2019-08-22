import * as rollup from 'rollup';
import {
	OutputOptions,
	InputOptions,
	RollupWatchOptions,
	RollupOutput,
	RollupBuild,
	ExistingRawSourceMap,
} from 'rollup';
import * as resolvePluginFIXME from 'rollup-plugin-node-resolve';
import * as commonjsPluginFIXME from 'rollup-plugin-commonjs';
import * as terserPlugin from 'rollup-plugin-terser';
import * as typescriptPlugin from 'rollup-plugin-typescript';
import {resolve} from 'path';
import {magenta} from 'kleur';

import {rainbow} from '../utils/node';
import {logger, LogLevel, Logger} from '../utils/logger';
import {diagnosticsPlugin} from './rollup-plugin-diagnostics';
import {deindent} from '../utils/str';
import {plainCssPlugin} from './rollup-plugin-plain-css';
import {outputCssPlugin} from './rollup-plugin-output-css';
import {createCssCache, CssBuild} from './cssCache';

// TODO These modules require `esModuleInterop` to work correctly.
// Rather than doing that and forcing `allowSyntheticDefaultImports`,
// I'm opting to just fix the module types after importing for now.
// This can probably be sorted out cleanly when `ts-node` supports ES modules.
const resolvePlugin: typeof resolvePluginFIXME.default = resolvePluginFIXME as any;
const commonjsPlugin: typeof commonjsPluginFIXME.default = commonjsPluginFIXME as any;

export interface BuildOptions {
	dev: boolean;
	inputFiles: string[];
	outputDir: string;
	watch: boolean;
	host: string;
	port: number;
	logLevel: LogLevel;
}
export type RequiredBuildOptions = never;
export type InitialBuildOptions = PartialExcept<
	BuildOptions,
	RequiredBuildOptions
>;
export const defaultBuildOptions = (
	initialOptions: InitialBuildOptions,
): BuildOptions => ({
	dev: true,
	inputFiles: [resolve('index.ts')],
	outputDir: process.cwd(),
	watch: true,
	host: 'localhost', // '0.0.0.0'?
	port: 8999,
	logLevel: LogLevel.Trace, // TODO this should be info
	...initialOptions,
});

interface Build {
	promise: Promise<void>;
}

export const createBuild = (opts: InitialBuildOptions): Build => {
	const options = defaultBuildOptions(opts);
	const {logLevel} = options;

	const log = logger(logLevel, [magenta('[build]')]);
	const {trace} = log;

	trace('build options', options);

	const promise = runBuild(options, log);

	return {promise};
};

const runBuild = async (options: BuildOptions, log: Logger): Promise<void> => {
	const {info} = log;

	info(`building for ${options.dev ? 'development' : 'production'}`);

	// run rollup
	if (options.watch) {
		// run the watcher
		info('building and watching');
		await runRollupWatcher(options, log);
		info('stopped watching');
	} else {
		// build the js
		info('building');
		await runRollupBuild(options, log);
		info(
			'\n' +
				rainbow(
					deindent(`
						~~~~~~~~~~~~~~~~~
						~~❤~~ built ~~❤~~
						~~~~~~~~~~~~~~~~~
				`),
				),
		);
	}
};

interface GroCssBuild extends CssBuild {
	map: ExistingRawSourceMap | undefined;
}

const createInputOptions = (
	inputFile: string,
	{dev, logLevel}: BuildOptions,
	{trace}: Logger,
): InputOptions => {
	const cssCache = createCssCache<GroCssBuild>({logLevel});
	const addPlainCssBuild = cssCache.addCssBuild.bind(null, 'bundle.css'); // TODO path

	const inputOptions: InputOptions = {
		// — core input options
		// external,
		input: inputFile, // required
		plugins: [
			diagnosticsPlugin({logLevel}),
			typescriptPlugin(),
			plainCssPlugin({
				addCssBuild: addPlainCssBuild,
				logLevel,
			}),
			outputCssPlugin({
				getCssBundles: cssCache.getCssBundles,
				sourcemap: dev,
				logLevel,
			}),
			resolvePlugin(),
			commonjsPlugin(),
			dev ? null : terserPlugin.terser(),
		],

		// — advanced input options
		// cache,
		// inlineDynamicImports,
		// manualChunks,
		// onwarn,
		// preserveModules,

		// — danger zone
		// acorn,
		// acornInjectPlugins,
		// context,
		// moduleContext,
		// preserveSymlinks,
		// shimMissingExports,
		// treeshake,

		// — experimental
		// chunkGroupingSize,
		// experimentalCacheExpiry,
		// experimentalOptimizeChunks,
		// experimentalTopLevelAwait,
		// perf
	};
	trace('inputOptions', inputOptions);
	return inputOptions;
};

const createOutputOptions = (
	{outputDir}: BuildOptions,
	{trace}: Logger,
): OutputOptions => {
	const outputOptions: OutputOptions = {
		// — core output options
		// dir: outputDir,
		file: join(outputDir, 'bundle.js'), // TODO this is temporarily hardcoded
		format: 'esm', // required
		// globals,
		name: 'app',

		// — advanced output options
		// assetFileNames,
		// banner,
		// chunkFileNames,
		// compact,
		// entryFileNames,
		// extend,
		// footer,
		// interop,
		// intro,
		// outro,
		// paths,
		// sourcemap,
		// sourcemapExcludeSources,
		// sourcemapFile,
		// sourcemapPathTransform,

		// — danger zone
		// amd,
		// dynamicImportFunction,
		// esModule,
		// exports,
		// freeze,
		// indent,
		// namespaceToStringTag,
		// noConflict,
		// preferConst,
		// strict
	};
	trace('outputOptions', outputOptions);
	return outputOptions;
};

const createWatchOptions = (
	inputFile: string,
	options: BuildOptions,
	log: Logger,
): RollupWatchOptions => {
	const watchOptions: RollupWatchOptions = {
		...createInputOptions(inputFile, options, log),
		output: createOutputOptions(options, log),
		watch: {
			// chokidar,
			clearScreen: false,
			exclude: ['node_modules/**'],
			// include,
		},
	};
	return watchOptions;
};

interface BuildResult {
	build: RollupBuild;
	output: RollupOutput;
}

const runRollupBuild = async (
	options: BuildOptions,
	log: Logger,
): Promise<BuildResult[]> => {
	// We're running builds sequentially,
	// because doing them in parallel makes the logs incomprehensible.
	// Maybe make parallel an option?
	const results: BuildResult[] = [];
	for (const inputFile of options.inputFiles) {
		const inputOptions = createInputOptions(inputFile, options, log);
		const outputOptions = createOutputOptions(options, log);

		const build = await rollup.rollup(inputOptions);

		const output = await build.generate(outputOptions);

		// for (const chunkOrAsset of output.output) {
		//   if (chunkOrAsset.isAsset) {
		//     // For assets, this contains
		//     // {
		//     //   isAsset: true,                 // signifies that this is an asset
		//     //   fileName: string,              // the asset file name
		//     //   source: string | Buffer        // the asset source
		//     // }
		//     console.log('Asset', chunkOrAsset);
		//   } else {
		//     // For chunks, this contains
		//     // {
		//     //   code: string,                  // the generated JS code
		//     //   dynamicImports: string[],      // external modules imported dynamically by the chunk
		//     //   exports: string[],             // exported variable names
		//     //   facadeModuleId: string | null, // the id of a module that this chunk corresponds to
		//     //   fileName: string,              // the chunk file name
		//     //   imports: string[],             // external modules imported statically by the chunk
		//     //   isDynamicEntry: boolean,       // is this chunk a dynamic entry point
		//     //   isEntry: boolean,              // is this chunk a static entry point
		//     //   map: string | null,            // sourcemaps if present
		//     //   modules: {                     // information about the modules in this chunk
		//     //     [id: string]: {
		//     //       renderedExports: string[]; // exported variable names that were included
		//     //       removedExports: string[];  // exported variable names that were removed
		//     //       renderedLength: number;    // the length of the remaining code in this module
		//     //       originalLength: number;    // the original length of the code in this module
		//     //     };
		//     //   },
		//     //   name: string                   // the name of this chunk as used in naming patterns
		//     // }
		//     console.log('Chunk', chunkOrAsset.modules);
		//   }
		// }

		await build.write(outputOptions); // don't care about the output of this - maybe refactor

		results.push({build, output});
	}
	return results;
};

const runRollupWatcher = async (
	options: BuildOptions,
	log: Logger,
): Promise<void> => {
	const {info, error} = log;
	return new Promise((_resolve, reject) => {
		const watchOptions = options.inputFiles.map(f =>
			createWatchOptions(f, options, log),
		);
		// trace(('watchOptions'), watchOptions);
		const watcher = rollup.watch(watchOptions);

		watcher.on('event', event => {
			info(`rollup event: ${event.code}`);
			switch (event.code) {
				case 'START': // the watcher is (re)starting
				case 'BUNDLE_START': // building an individual bundle
				case 'BUNDLE_END': // finished building a bundle
					break;
				case 'END': // finished building all bundles
					info(rainbow('~~end~~'), '\n\n');
					break;
				case 'ERROR': // encountered an error while bundling
					error('error', event);
					reject(`Error: ${event.message}`);
					break;
				case 'FATAL': // encountered an unrecoverable error
					error('fatal', event);
					reject(`Fatal error: ${event.message}`);
					break;
				default:
					throw Error(`Unknown rollup watch event code: ${event.code}`);
			}
		});

		// call this ever?
		// watcher.close();
	});
};
