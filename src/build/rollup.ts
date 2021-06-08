import {
	rollup,
	watch,
	OutputOptions,
	InputOptions,
	InputOption,
	RollupWatchOptions,
	RollupOutput,
	RollupBuild,
} from 'rollup';
import resolvePlugin from '@rollup/plugin-node-resolve';
import commonjsPlugin from '@rollup/plugin-commonjs';
import {rainbow} from '@feltcoop/felt/utils/terminal.js';
import {System_Logger, print_log_label} from '@feltcoop/felt/utils/log.js';
import type {Logger} from '@feltcoop/felt/utils/log.js';
import {deindent} from '@feltcoop/felt/utils/string.js';
import {omitUndefined} from '@feltcoop/felt/utils/object.js';
import {Unreachable_Error} from '@feltcoop/felt/utils/error.js';
import {identity} from '@feltcoop/felt/utils/function.js';
import type {PartialExcept} from '@feltcoop/felt/utils/types.js';

import {diagnosticsPlugin} from './rollup_plugin_diagnostics.js';
// import {groTerserPlugin} from './rollup-plugin-gro-terser.js';
import {paths} from '../paths.js';

export interface Options {
	input: InputOption;
	dev: boolean;
	sourcemap: boolean;
	outputDir: string;
	watch: boolean;
	map_input_options: Map_Input_Options;
	map_output_options: Map_Output_Options;
	map_watch_options: Map_Watch_Options;
	log: Logger;
}
export type RequiredOptions = 'input';
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => ({
	dev: true,
	sourcemap: opts.dev ?? true,
	outputDir: paths.dist,
	watch: false,
	map_input_options: identity,
	map_output_options: identity,
	map_watch_options: identity,
	...omitUndefined(opts),
	log: opts.log || new System_Logger(print_log_label('build')),
});

export type Map_Input_Options = (o: InputOptions, b: Options) => InputOptions;
export type Map_Output_Options = (o: OutputOptions, b: Options) => OutputOptions;
export type Map_Watch_Options = (o: RollupWatchOptions, b: Options) => RollupWatchOptions;

export const runRollup = async (opts: InitialOptions): Promise<void> => {
	const options = initOptions(opts);
	const {log} = options;

	log.info(`building for ${options.dev ? 'development' : 'production'}`);
	log.trace('build options', options);

	// run rollup
	if (options.watch) {
		// run the watcher
		log.info('building and watching');
		await runRollupWatcher(options, log);
		log.info('stopped watching');
	} else {
		// build the js
		log.info('building');
		await runRollupBuild(options, log);
		log.info(
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

const createInputOptions = (options: Options, _log: Logger): InputOptions => {
	const unmappedInputOptions: InputOptions = {
		// >> core input options
		// external,
		input: options.input, // required
		plugins: [
			diagnosticsPlugin(),
			resolvePlugin({preferBuiltins: true}),
			commonjsPlugin(),
			// TODO re-enable terser, but add a config option (probably `terser` object)
			// ...(dev ? [] : [groTerserPlugin({minifyOptions: {sourceMap: sourcemap}})]),
		],

		// >> advanced input options
		// cache,
		// onwarn,
		// preserveEntrySignatures,
		// strictDeprecations,

		// >> danger zone
		// acorn,
		// acornInjectPlugins,
		// context,
		// moduleContext,
		// preserveSymlinks,
		// shimMissingExports,
		// treeshake,

		// >> experimental
		// experimentalCacheExpiry,
		// perf
	};
	const inputOptions = options.map_input_options(unmappedInputOptions, options);
	// log.trace('inputOptions', inputOptions);
	return inputOptions;
};

const createOutputOptions = (options: Options, log: Logger): OutputOptions => {
	const unmappedOutputOptions: OutputOptions = {
		// >> core output options
		dir: options.outputDir,
		// file,
		format: 'esm', // required
		// globals,
		name: 'app',
		// plugins,

		// >> advanced output options
		// assetFileNames,
		// banner,
		// chunkFileNames,
		// compact,
		// entryFileNames,
		// extend,
		// footer,
		// hoistTransitiveImports,
		// inlineDynamicImports,
		// interop,
		// intro,
		// manualChunks,
		// minifyInternalExports,
		// outro,
		// paths,
		// preserveModules,
		// preserveModulesRoot,
		sourcemap: options.sourcemap,
		// sourcemapExcludeSources,
		// sourcemapFile,
		// sourcemapPathTransform,

		// >> danger zone
		// amd,
		// esModule,
		// exports,
		// externalLiveBindings,
		// freeze,
		// indent,
		// namespaceToStringTag,
		// noConflict,
		// preferConst,
		// strict,
		// systemNullSetters,
	};
	const outputOptions = options.map_output_options(unmappedOutputOptions, options);
	log.trace('outputOptions', outputOptions);
	return outputOptions;
};

const createWatchOptions = (options: Options, log: Logger): RollupWatchOptions => {
	const unmappedWatchOptions: RollupWatchOptions = {
		...createInputOptions(options, log),
		output: createOutputOptions(options, log),
		watch: {
			// chokidar,
			clearScreen: false,
			exclude: ['node_modules/**'],
			// include,
		},
	};
	const watchOptions = options.map_watch_options(unmappedWatchOptions, options);
	// log.trace('watchOptions', watchOptions);
	return watchOptions;
};

interface RollupBuildResult {
	build: RollupBuild;
	output: RollupOutput;
}

const runRollupBuild = async (options: Options, log: Logger): Promise<RollupBuildResult> => {
	const inputOptions = createInputOptions(options, log);
	const outputOptions = createOutputOptions(options, log);
	const build = await rollup(inputOptions);
	const output = await build.write(outputOptions);
	return {build, output};

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
};

const runRollupWatcher = async (options: Options, log: Logger): Promise<void> => {
	return new Promise((_resolve, reject) => {
		const watchOptions = createWatchOptions(options, log);
		// trace(('watchOptions'), watchOptions);
		const watcher = watch(watchOptions);

		watcher.on('event', (event) => {
			log.info(`rollup event: ${event.code}`);
			switch (event.code) {
				case 'START': // the watcher is (re)starting
				case 'BUNDLE_START': // building an individual bundle
				case 'BUNDLE_END': // finished building a bundle
					break;
				case 'END': // finished building all bundles
					log.info(rainbow('~~end~~'), '\n\n');
					break;
				case 'ERROR': // encountered an error while bundling
					log.error('error', event);
					reject(`Error: ${event.error.message}`);
					break;
				default:
					throw new Unreachable_Error(event);
			}
		});

		// call this ever?
		// watcher.close();
	});
};
