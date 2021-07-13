import {strip_trailing_slash, to_common_base_dir} from '@feltcoop/felt/util/path.js';
import {ensure_end} from '@feltcoop/felt/util/string.js';
import {EMPTY_OBJECT} from '@feltcoop/felt/util/object.js';
import type {Plugin as Rollup_Plugin} from 'rollup';
import {extname} from 'path';

import type {Adapter} from 'src/adapt/adapt.js';
import type {Map_Input_Options} from 'src/build/rollup.js';
import {run_rollup} from '../build/rollup.js';
import {DIST_DIRNAME, source_id_to_base_path, to_import_id} from '../paths.js';
import {print_build_config_label, to_input_files} from '../build/build_config.js';
import type {Build_Name} from 'src/build/build_config.js';
import type {Host_Target} from 'src/adapt/utils.js';
import {copy_dist, ensure_nojekyll} from './utils.js';
import {BROWSER_BUILD_NAME, default_non_asset_extensions} from '../build/default_build_config.js';
import type {Id_Stats_Filter} from 'src/fs/filter.js';

export interface Options {
	build_name: Build_Name;
	dir: string;
	minify: boolean;
	host_target: Host_Target;
	filter: Id_Stats_Filter;
}

export const create_adapter = ({
	build_name = BROWSER_BUILD_NAME,
	dir = `${DIST_DIRNAME}/${build_name}`,
	minify = true,
	host_target = 'github_pages',
	filter = default_filter,
}: Partial<Options> = EMPTY_OBJECT): Adapter => {
	dir = strip_trailing_slash(dir);
	return {
		name: '@feltcoop/gro_adapter_gro_frontend',
		adapt: async ({config, fs, args, log, dev, timings}) => {
			await fs.remove(dir);

			const {map_input_options, map_output_options, map_watch_options} = args;

			// Infer which of the inputs are actual source files,
			// and therefore belong in the default Rollup build.
			// If more customization is needed, users should implement their own `src/build.task.ts`,
			// which can be bootstrapped by copy/pasting this one. (and updating the imports)
			const build_config = config.builds.find((b) => b.name === build_name);
			if (!build_config) {
				throw Error(`Cannot find build config named ${build_name}`);
			}

			const timing_to_bundle = timings.start('bundle');
			const files = to_input_files(build_config.input);
			if (files.length) {
				const input = files.map((source_id) => to_import_id(source_id, dev, build_name));
				const output_dir = `${dir}/${source_id_to_base_path(
					ensure_end(to_common_base_dir(files), '/'),
				)}`;
				log.info('building', print_build_config_label(build_config), output_dir, files);
				console.log('config.sourcemap', config.sourcemap);
				await run_rollup({
					fs,
					dev,
					sourcemap: config.sourcemap,
					input,
					output_dir,
					map_input_options:
						map_input_options ||
						// refactor lol
						(await (async () => {
							const plugins: Rollup_Plugin[] = [];
							if (minify) {
								plugins.push(
									(await import('../build/rollup_plugin_gro_terser.js')).rollup_plugin_gro_terser({
										minify_options: {sourceMap: config.sourcemap},
									}),
								);
							}
							const map_rollup_input_options: Map_Input_Options = (r) => ({
								...r,
								plugins: (r.plugins || []).concat(plugins),
							});
							return map_rollup_input_options;
						})()),
					map_output_options,
					map_watch_options,
				});
			} else {
				log.trace('no input files in', print_build_config_label(build_config));
			}
			timing_to_bundle();

			// TODO this should actually filter based on the build config input, no?
			await copy_dist(fs, build_config, dev, dir, log, filter);

			if (host_target === 'github_pages') {
				await ensure_nojekyll(fs, dir);
			}
		},
	};
};

const default_filter: Id_Stats_Filter = (id) => !default_non_asset_extensions.has(extname(id));
