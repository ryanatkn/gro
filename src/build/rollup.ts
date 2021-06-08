import {
	rollup,
	watch,
	OutputOptions as Rollup_Output_Options,
	InputOptions as Rollup_Input_Options,
	InputOption as Rollup_Input_Option,
	RollupWatchOptions as Rollup_Watch_Options,
	RollupOutput as Rollup_Output,
	RollupBuild as Rollup_Build,
} from 'rollup';
import resolve_plugin from '@rollup/plugin-node-resolve';
import commonjs_plugin from '@rollup/plugin-commonjs';
import {rainbow} from '@feltcoop/felt/util/terminal.js';
import {System_Logger, print_log_label} from '@feltcoop/felt/util/log.js';
import type {Logger} from '@feltcoop/felt/util/log.js';
import {deindent} from '@feltcoop/felt/util/string.js';
import {omit_undefined} from '@feltcoop/felt/util/object.js';
import {Unreachable_Error} from '@feltcoop/felt/util/error.js';
import {identity} from '@feltcoop/felt/util/function.js';
import type {Partial_Except} from '@feltcoop/felt/util/types.js';

import {diagnosticsPlugin} from './rollup_plugin_diagnostics.js';
// import {gro_terser_plugin} from './rollup-plugin-gro-terser.js';
import {paths} from '../paths.js';

export interface Options {
	input: InputOption;
	dev: boolean;
	sourcemap: boolean;
	output_dir: string;
	watch: boolean;
	map_input_options: Map_Input_Options;
	map_output_options: Map_Output_Options;
	map_watch_options: Map_Watch_Options;
	log: Logger;
}
export type Required_Options = 'input';
export type Initial_Options = Partial_Except<Options, Required_Options>;
export const init_options = (opts: Initial_Options): Options => ({
	dev: true,
	sourcemap: opts.dev ?? true,
	output_dir: paths.dist,
	watch: false,
	map_input_options: identity,
	map_output_options: identity,
	map_watch_options: identity,
	...omit_undefined(opts),
	log: opts.log || new System_Logger(print_log_label('build')),
});

export type Map_Input_Options = (o: Rollup_Input_Options, b: Options) => Rollup_Input_Options;
export type Map_Output_Options = (o: Rollup_Output_Options, b: Options) => Rollup_Output_Options;
export type Map_Watch_Options = (o: Rollup_Watch_Options, b: Options) => Rollup_Watch_Options;

export const runRollup = async (opts: Initial_Options): Promise<void> => {
	const options = init_options(opts);
	const {log} = options;

	log.info(`building for ${options.dev ? 'development' : 'production'}`);
	log.trace('build options', options);

	// run rollup
	if (options.watch) {
		// run the watcher
		log.info('building and watching');
		await run_rollup_watcher(options, log);
		log.info('stopped watching');
	} else {
		// build the js
		log.info('building');
		await run_rollup_build(options, log);
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

const create_input_options = (options: Options, _log: Logger): Rollup_Input_Options => {
	const unmapped_input_options: Rollup_Input_Options = {
		// >> core input options
		// external,
		input: options.input, // required
		plugins: [
			diagnosticsPlugin(),
			resolve_plugin({preferBuiltins: true}),
			commonjs_plugin(),
			// TODO re-enable terser, but add a config option (probably `terser` object)
			// ...(dev ? [] : [gro_terser_plugin({minify_options: {sourceMap: sourcemap}})]),
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
	const input_options = options.map_input_options(unmapped_input_options, options);
	// log.trace('input_options', input_options);
	return input_options;
};

const create_output_options = (options: Options, log: Logger): Rollup_Output_Options => {
	const unmapped_output_options: Rollup_Output_Options = {
		// >> core output options
		dir: options.output_dir,
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
	const output_options = options.map_output_options(unmapped_output_options, options);
	log.trace('output_options', output_options);
	return output_options;
};

const create_watch_options = (options: Options, log: Logger): Rollup_Watch_Options => {
	const unmapped_watch_options: Rollup_Watch_Options = {
		...create_input_options(options, log),
		output: create_output_options(options, log),
		watch: {
			// chokidar,
			clearScreen: false,
			exclude: ['node_modules/**'],
			// include,
		},
	};
	const watch_options = options.map_watch_options(unmapped_watch_options, options);
	// log.trace('watch_options', watch_options);
	return watch_options;
};

interface Rollup_Build_Result {
	build: Rollup_Build;
	output: Rollup_Output;
}

const run_rollup_build = async (options: Options, log: Logger): Promise<Rollup_Build_Result> => {
	const input_options = create_input_options(options, log);
	const output_options = create_output_options(options, log);
	const build = await rollup(input_options);
	const output = await build.write(output_options);
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

const run_rollup_watcher = async (options: Options, log: Logger): Promise<void> => {
	return new Promise((_resolve, reject) => {
		const watch_options = create_watch_options(options, log);
		// trace(('watch_options'), watch_options);
		const watcher = watch(watch_options);

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
