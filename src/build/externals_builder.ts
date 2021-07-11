import {basename, dirname, join} from 'path';
import {install as installWithEsinstall} from 'esinstall';
import type {InstallResult} from 'esinstall';
import type {Plugin as RollupPlugin} from 'rollup';
import {print_log_label, System_Logger} from '@feltcoop/felt/util/log.js';
import type {Logger} from '@feltcoop/felt/util/log.js';
import {omit_undefined} from '@feltcoop/felt/util/object.js';
import {cyan, gray} from '@feltcoop/felt/util/terminal.js';
import {EMPTY_ARRAY} from '@feltcoop/felt/util/array.js';
import {to_env_number} from '@feltcoop/felt/util/env.js';

import {EXTERNALS_BUILD_DIRNAME, JS_EXTENSION, to_build_out_path} from '../paths.js';
import type {Builder, Build_Context, Text_Build_Source} from './builder.js';
import {load_content} from './load.js';
import {rollup_plugin_gro_svelte} from './rollup_plugin_gro_svelte.js';
import {create_default_preprocessor} from './svelte_build_helpers.js';
import {create_css_cache} from './css_cache.js';
import {print_build_config} from '../build/build_config.js';
import type {Build_Config} from '../build/build_config.js';
import {
	create_delayed_promise,
	get_externals_builder_state,
	get_externals_build_state,
	init_externals_builder_state,
	initExternals_Build_State,
	load_import_map_from_disk,
	to_specifiers,
	EXTERNALS_SOURCE_ID,
} from './externals_build_helpers.js';
import type {Externals_Build_State} from './externals_build_helpers.js';
import type {Filesystem} from '../fs/filesystem.js';
import type {Build_File} from './build_file.js';
import {postprocess} from './postprocess.js';

/*

TODO this currently uses esinstall in a hacky way, (tbh this file is nightmare of unknown behavior)
using timeouts and polling state on intervals and other garbo. see below for more.
it's maybe fine but might cause problems.
it causes unnecessary delays building externals tho.

the root of the problem is that esinstall doesn't like being thrown incessant instructions,
seems to prefer us to be incremental instead, which is fine,
but this isn't a great solution

*/

export interface Options {
	install: typeof installWithEsinstall;
	base_path: string;
	log: Logger;
}
export type Initial_Options = Partial<Options>;
export const init_options = (opts: Initial_Options): Options => {
	const log = opts.log || new System_Logger(print_log_label('externals_builder', cyan));
	return {
		install: installWithEsinstall,
		base_path: EXTERNALS_BUILD_DIRNAME,
		...omit_undefined(opts),
		log,
	};
};

type ExternalsBuilder = Builder<Text_Build_Source>;

const encoding = 'utf8';

export const create_externals_builder = (opts: Initial_Options = {}): ExternalsBuilder => {
	const {install, base_path, log} = init_options(opts);

	const build: ExternalsBuilder['build'] = async (source, build_config, ctx) => {
		const {fs, build_dir, dev, sourcemap, target, state, externals_aliases} = ctx;

		// if (sourcemap) {
		// 	log.warn('Source maps are not yet supported by the externals builder.');
		// }
		if (source.encoding !== encoding) {
			throw Error(`Externals builder only handles utf8 encoding, not ${source.encoding}`);
		}

		const builder_state = get_externals_builder_state(state);
		const build_state = get_externals_build_state(builder_state, build_config);

		const dest = to_build_out_path(dev, build_config.name, base_path, build_dir);

		log.info(`bundling externals ${print_build_config(build_config)}: ${gray(source.id)}`);

		// TODO this is legacy stuff that we need to rethink when we handle CSS better
		const css_cache = create_css_cache();
		// const addPlainCss_Build = css_cache.add_css_build.bind(null, 'bundle.plain.css');
		const add_svelte_css_build = css_cache.add_css_build.bind(null, 'bundle.svelte.css');
		const plugins: RollupPlugin[] = [
			rollup_plugin_gro_svelte({
				dev,
				add_css_build: add_svelte_css_build,
				preprocessor: create_default_preprocessor(dev, target, sourcemap),
				compile_options: {},
			}),
		];

		let build_files: Build_File[];
		let install_result: InstallResult;
		try {
			log.info('installing externals', build_state.specifiers);
			install_result = await install(Array.from(build_state.specifiers), {
				dest,
				rollup: {plugins} as any, // TODO type problem with esinstall and rollup
				polyfillNode: true, // needed for some libs - maybe make customizable?
				alias: externals_aliases,
			});
			log.info('install result', install_result);
			// log.trace('previous import map', state.import_map); maybe diff?
			build_state.import_map = install_result.importMap;
			build_files = [
				...(await Promise.all(
					Array.from(build_state.specifiers).map(async (specifier): Promise<Build_File> => {
						const id = join(dest, install_result.importMap.imports[specifier]);

						// TODO
						// const {content, dependencies_by_build_id} = await postprocess(
						// 	dir,
						// 	extension,
						// 	encoding,
						// 	original_content,
						// 	build_config,
						// 	ctx,
						// 	result,
						// 	source_file,
						// );
						return {
							type: 'build',
							source_id: source.id,
							build_config,
							dependencies_by_build_id: null, // TODO
							id,
							filename: basename(id),
							dir: dirname(id),
							extension: JS_EXTENSION,
							encoding,
							content: await load_content(fs, encoding, id),
							content_buffer: undefined,
							content_hash: undefined,
							stats: undefined,
							mime_type: undefined,
						};
					}),
				)),
				...((await load_common_builds(fs, install_result, dest, build_config)) || EMPTY_ARRAY),
			];
		} catch (err) {
			log.error(`Failed to bundle external module: ${source.id}`);
			throw err;
		}

		return Promise.all(
			build_files.map((build_file) => postprocess(build_file, ctx, build_files, source)),
		);
	};

	const init: ExternalsBuilder['init'] = async ({
		fs,
		state,
		dev,
		build_configs,
		build_dir,
	}: Build_Context): Promise<void> => {
		// initialize the externals builder state, which is stored on the `Build_Context` (the filer)
		const builder_state = init_externals_builder_state(state);
		// mutate the build state with any available initial values
		await Promise.all(
			build_configs!.map(async (build_config) => {
				if (build_config.platform !== 'browser') return;
				const build_state = initExternals_Build_State(builder_state, build_config);
				const dest = to_build_out_path(dev, build_config.name, base_path, build_dir);
				const import_map = await load_import_map_from_disk(fs, dest);
				if (import_map !== undefined) {
					build_state.import_map = import_map;
					build_state.specifiers = to_specifiers(import_map);
				}
			}),
		);
	};

	return {name: '@feltcoop/gro_builder_externals', build, init};
};

// TODO this is really hacky - it's working in the general case,
// but it causes unnecessary delays building externals
const IDLE_CHECK_INTERVAL = 200; // needs to be smaller than `IDLE_CHECK_DELAY`
const IDLE_CHECK_DELAY = 700; // needs to be larger than `IDLE_CHECK_INTERVAL`
const IDLE_TIME_LIMIT = to_env_number('GRO_IDLE_TIME_LIMIT', 20_000); // TODO hacky failsafe, it'll time out after this long, which may be totally busted in some cases..
// TODO wait what's the relationship between those two? check for errors?

// TODO this hackily guesses if the filer is idle enough to start installing externals
export const queue_externals_build = async (
	source_id: string,
	state: Externals_Build_State,
	building_source_files: Set<string>,
	log: Logger,
	cb: () => Promise<void>, // last cb wins!
): Promise<void> => {
	state.installing_cb = cb;
	building_source_files.delete(source_id); // externals are hacky like this, because they'd cause it to hang!
	if (state.installing === null) {
		state.installing = create_delayed_promise(async () => {
			state.installing = null; // TODO so.. putting this after `cb()` causes an error
			await state.installing_cb!();
			state.installing_cb = null;
		}, IDLE_CHECK_DELAY);
		state.idle_timer = 0;
		state.resetter_interval = setInterval(() => {
			state.idle_timer += IDLE_CHECK_INTERVAL; // this is not a precise time value
			if (state.idle_timer > IDLE_TIME_LIMIT) {
				log.error(`installing externals timed out. this is a bug .. somewhere: ${source_id}`);
				clearInterval(state.resetter_interval!);
				state.resetter_interval = null;
				state.idle_timer = 0;
				return;
			}
			state.installing!.reset();
			if (building_source_files.size === 0) {
				setTimeout(() => {
					// check again in a moment just to be sure
					// TODO make this more robust lol
					if (building_source_files.size === 0) {
						clearInterval(state.resetter_interval!);
						state.resetter_interval = null;
						state.idle_timer = 0;
					}
				}, IDLE_CHECK_INTERVAL / 3); // TODO would cause a bug if this ever fires after the next interval
			}
		}, IDLE_CHECK_INTERVAL);
	}
	state.installing.reset();
	return state.installing.promise;
};

const load_common_builds = async (
	fs: Filesystem,
	install_result: InstallResult,
	dest: string,
	build_config: Build_Config,
): Promise<Build_File[] | null> => {
	const common_dependency_ids = Object.keys(install_result.stats.common).map((path) =>
		join(dest, path),
	);
	if (!common_dependency_ids.length) return null;
	// log.trace('loading common dependencies', common_dependency_ids);
	return Promise.all(
		common_dependency_ids.map(async (common_dependency_id): Promise<Build_File> => {
			return {
				type: 'build',
				source_id: EXTERNALS_SOURCE_ID,
				build_config,
				dependencies_by_build_id: null,
				id: common_dependency_id,
				filename: basename(common_dependency_id),
				dir: dirname(common_dependency_id),
				extension: JS_EXTENSION,
				encoding,
				content: await load_content(fs, encoding, common_dependency_id),
				content_buffer: undefined,
				content_hash: undefined,
				stats: undefined,
				mime_type: undefined,
			};
		}),
	);
};
