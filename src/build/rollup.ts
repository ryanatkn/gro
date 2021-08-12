import type {
	OutputOptions as RollupOutputOptions,
	InputOptions as RollupInputOptions,
	InputOption as RollupInputOption,
	RollupWatchOptions as RollupWatchOptions,
	RollupOutput as RollupOutput,
	RollupBuild as RollupBuild,
} from 'rollup';
import {rollup, watch} from 'rollup';
import resolve_plugin from '@rollup/plugin-node-resolve';
import commonjs_plugin from '@rollup/plugin-commonjs';
import {rainbow} from '@feltcoop/felt/util/terminal.js';
import {System_Logger} from '@feltcoop/felt/util/log.js';
import {print_log_label} from '@feltcoop/felt/util/log.js';
import type {Logger} from '@feltcoop/felt/util/log.js';
import {deindent} from '@feltcoop/felt/util/string.js';
import {omit_undefined} from '@feltcoop/felt/util/object.js';
import {Unreachable_Error} from '@feltcoop/felt/util/error.js';
import {identity} from '@feltcoop/felt/util/function.js';
import type {Partial_Except} from '@feltcoop/felt/util/types.js';

import {rollup_plugin_gro_diagnostics} from './rollup_plugin_gro_diagnostics.js';
import {paths} from '../paths.js';
import {rollup_plugin_gro_output_css} from './rollup_plugin_gro_output_css.js';
import type {Filesystem} from 'src/fs/filesystem.js';
import {rollup_plugin_gro_plain_css} from './rollup_plugin_gro_plain_css.js';
import type {CssCache} from 'src/build/css_cache.js';
import {create_css_cache} from './css_cache.js';
import type {GroCssBuild} from 'src/build/gro_css_build.js';
import {rollup_plugin_gro_svelte} from './rollup_plugin_gro_svelte.js';
import {create_default_preprocessor} from './gro_builder_svelte_utils.js';
import type {EcmaScriptTarget} from 'src/build/typescript_utils.js';
import {DEFAULT_ECMA_SCRIPT_TARGET} from './build_config_defaults.js';

export interface Options {
	fs: Filesystem;
	input: RollupInputOption;
	dev: boolean;
	target: EcmaScriptTarget;
	sourcemap: boolean;
	output_dir: string;
	watch: boolean;
	map_input_options: MapInputOptions;
	map_output_options: MapOutputOptions;
	map_watch_options: MapWatchOptions;
	css_cache: CssCache<GroCssBuild>;
	log: Logger;
}
export type RequiredOptions = 'fs' | 'input';
export type InitialOptions = Partial_Except<Options, RequiredOptions>;
export const init_options = (opts: InitialOptions): Options => ({
	dev: true,
	target: DEFAULT_ECMA_SCRIPT_TARGET,
	sourcemap: opts.dev ?? true,
	output_dir: paths.dist,
	watch: false,
	map_input_options: identity,
	map_output_options: identity,
	map_watch_options: identity,
	css_cache: opts.css_cache || create_css_cache(),
	...omit_undefined(opts),
	log: opts.log || new System_Logger(print_log_label('build')),
});

export type MapInputOptions = (
	r: RollupInputOptions,
	o: Options,
) => RollupInputOptions | Promise<RollupInputOptions>;
export type MapOutputOptions = (
	r: RollupOutputOptions,
	o: Options,
) => RollupOutputOptions | Promise<RollupOutputOptions>;
export type MapWatchOptions = (
	r: RollupWatchOptions,
	o: Options,
) => RollupWatchOptions | Promise<RollupWatchOptions>;

export const run_rollup = async (opts: InitialOptions): Promise<void> => {
	const options = init_options(opts);
	const {log} = options;

	log.info(`building for ${options.dev ? 'development' : 'production'}`);
	log.trace('build options', options);

	if (options.watch) {
		// run the watcher
		log.info('building and watching');
		await run_rollup_watcher(options, log);
		log.info('stopped watching');
	} else {
		// build without watching
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

const create_input_options = async (options: Options): Promise<RollupInputOptions> => {
	const {fs, css_cache, dev, target, sourcemap} = options;

	const add_plain_css_build = css_cache.add_css_build.bind(null, 'bundle.plain.css');
	const add_svelte_css_build = css_cache.add_css_build.bind(null, 'bundle.svelte.css');

	const unmapped_input_options: RollupInputOptions = {
		input: options.input,
		plugins: [
			rollup_plugin_gro_diagnostics(),
			rollup_plugin_gro_svelte({
				dev,
				add_css_build: add_svelte_css_build,
				preprocessor: create_default_preprocessor(dev, target, sourcemap),
				compile_options: {},
			}),
			rollup_plugin_gro_plain_css({fs, add_css_build: add_plain_css_build}),
			rollup_plugin_gro_output_css({
				fs,
				get_css_bundles: css_cache.get_css_bundles,
				sourcemap,
			}),
			resolve_plugin({preferBuiltins: true}),
			commonjs_plugin(),
		],
	};
	return options.map_input_options(unmapped_input_options, options);
};

const create_output_options = async (options: Options): Promise<RollupOutputOptions> => {
	const unmapped_output_options: RollupOutputOptions = {
		dir: options.output_dir,
		format: 'esm',
		name: 'app',
		sourcemap: options.sourcemap,
	};
	return options.map_output_options(unmapped_output_options, options);
};

const create_watch_options = async (options: Options): Promise<RollupWatchOptions> => {
	const unmapped_watch_options: RollupWatchOptions = {
		...create_input_options(options),
		output: await create_output_options(options),
		watch: {
			clearScreen: false,
			exclude: ['node_modules/**'],
		},
	};
	return options.map_watch_options(unmapped_watch_options, options);
};

interface RollupBuildResult {
	build: RollupBuild;
	output: RollupOutput;
}

const run_rollup_build = async (options: Options, log: Logger): Promise<RollupBuildResult> => {
	const input_options = await create_input_options(options);
	const output_options = await create_output_options(options);
	log.trace('input_options', input_options);
	log.trace('output_options', output_options);
	const build = await rollup(input_options);
	const output = await build.write(output_options);
	return {build, output};
};

const run_rollup_watcher = async (options: Options, log: Logger): Promise<void> => {
	return new Promise(async (_resolve, reject) => {
		const watch_options = await create_watch_options(options);
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

		// call this ever? teardown
		// watcher.close();
	});
};
