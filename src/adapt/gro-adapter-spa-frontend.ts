import {strip_trailing_slash, to_common_base_dir} from '@feltcoop/felt/util/path.js';
import {ensure_end} from '@feltcoop/felt/util/string.js';
import {EMPTY_OBJECT} from '@feltcoop/felt/util/object.js';

import type {Adapter} from './adapter.js';
import {run_rollup} from '../build/rollup.js';
import {DIST_DIRNAME, source_id_to_base_path, to_import_id} from '../paths.js';
import {print_build_config_label, to_input_files} from '../build/build_config.js';
import type {Build_Name} from '../build/build_config.js';
import type {Host_Target} from './utils.js';
import {copy_dist, ensure_nojekyll} from './utils.js';
import {BROWSER_BUILD_NAME} from '../build/default_build_config.js';

export interface Options {
	build_name: Build_Name;
	dir: string;
	host_target: Host_Target;
}

export const create_adapter = ({
	build_name = BROWSER_BUILD_NAME,
	dir = `${DIST_DIRNAME}/${build_name}`,
	host_target = 'github_pages',
}: Partial<Options> = EMPTY_OBJECT): Adapter => {
	dir = strip_trailing_slash(dir);
	return {
		name: '@feltcoop/gro-adapter-spa-frontend',
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
				await run_rollup({
					dev,
					sourcemap: config.sourcemap,
					input,
					output_dir,
					map_input_options,
					map_output_options,
					map_watch_options,
				});
			} else {
				log.trace('no input files in', print_build_config_label(build_config));
			}
			timing_to_bundle();

			// copy static prod files into `dist/`
			await copy_dist(fs, build_config, dev, dir, log);

			// GitHub pages processes everything with Jekyll by default,
			// breaking things like files and dirs prefixed with an underscore.
			// This adds a `.nojekyll` file to the root of the output
			// to tell GitHub Pages to treat the outputs as plain static files.
			if (host_target === 'github_pages') {
				await ensure_nojekyll(fs, dir);
			}
		},
	};
};
