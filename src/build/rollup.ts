import type {
	OutputOptions as Rollup_Output_Options,
	InputOptions as Rollup_Input_Options,
	InputOption as Rollup_Input_Option,
	RollupWatchOptions as Rollup_Watch_Options,
	RollupOutput as Rollup_Output,
	RollupBuild as Rollup_Build,
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
import type {Css_Cache} from 'src/build/css_cache.js';
import {create_css_cache} from './css_cache.js';
import type {Gro_Css_Build} from 'src/build/gro_css_build.js';
import {rollup_plugin_gro_svelte} from './rollup_plugin_gro_svelte.js';
import {create_default_preprocessor} from './gro_builder_svelte_utils.js';
import type {Ecma_Script_Target} from 'src/build/typescript_utils.js';
import {DEFAULT_ECMA_SCRIPT_TARGET} from './default_build_config.js';

export interface Options {
	fs: Filesystem;
	input: Rollup_Input_Option;
	dev: boolean;
	target: Ecma_Script_Target;
	sourcemap: boolean;
	output_dir: string;
	watch: boolean;
	map_input_options: Map_Input_Options;
	map_output_options: Map_Output_Options;
	map_watch_options: Map_Watch_Options;
	css_cache: Css_Cache<Gro_Css_Build>;
	log: Logger;
}
export type Required_Options = 'fs' | 'input';
export type Initial_Options = Partial_Except<Options, Required_Options>;
export const init_options = (opts: Initial_Options): Options => ({
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

export type Map_Input_Options = (
	r: Rollup_Input_Options,
	o: Options,
) => Rollup_Input_Options | Promise<Rollup_Input_Options>;
export type Map_Output_Options = (
	r: Rollup_Output_Options,
	o: Options,
) => Rollup_Output_Options | Promise<Rollup_Output_Options>;
export type Map_Watch_Options = (
	r: Rollup_Watch_Options,
	o: Options,
) => Rollup_Watch_Options | Promise<Rollup_Watch_Options>;

export const run_rollup = async (opts: Initial_Options): Promise<void> => {
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

const create_input_options = async (options: Options): Promise<Rollup_Input_Options> => {
	const {fs, css_cache, dev, target, sourcemap} = options;

	const add_plain_css_build = css_cache.add_css_build.bind(null, 'bundle.plain.css');
	const add_svelte_css_build = css_cache.add_css_build.bind(null, 'bundle.svelte.css');

	const unmapped_input_options: Rollup_Input_Options = {
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

const create_output_options = async (options: Options): Promise<Rollup_Output_Options> => {
	const unmapped_output_options: Rollup_Output_Options = {
		dir: options.output_dir,
		format: 'esm',
		name: 'app',
		sourcemap: options.sourcemap,
	};
	return options.map_output_options(unmapped_output_options, options);
};

const create_watch_options = async (options: Options): Promise<Rollup_Watch_Options> => {
	const unmapped_watch_options: Rollup_Watch_Options = {
		...create_input_options(options),
		output: await create_output_options(options),
		watch: {
			clearScreen: false,
			exclude: ['node_modules/**'],
		},
	};
	return options.map_watch_options(unmapped_watch_options, options);
};

interface Rollup_Build_Result {
	build: Rollup_Build;
	output: Rollup_Output;
}

const run_rollup_build = async (options: Options, log: Logger): Promise<Rollup_Build_Result> => {
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
