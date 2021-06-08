import {relative, dirname} from 'path';
import type {Logger} from '@feltcoop/felt/util/log.js';
import {strip_end} from '@feltcoop/felt/util/string.js';

import type {Build_Config} from '../build/build_config.js';
import type {Filesystem} from '../fs/filesystem.js';
import type {Path_Stats} from '../fs/path_data.js';
import {
	EXTERNALS_BUILD_DIRNAME,
	to_build_base_path,
	to_build_out_path,
	TS_EXTENSION,
	TS_TYPEMAP_EXTENSION,
	print_path,
	SOURCE_DIRNAME,
	paths,
} from '../paths.js';

// TODO make typemaps optional - how? on the `Build_Config`?
// or as an arg? on the main Gro config?

export const copy_dist = async (
	fs: Filesystem,
	build_config: Build_Config,
	dev: boolean,
	dist_out_dir: string,
	log: Logger,
	filter?: (id: string, stats: Path_Stats) => boolean,
	pack: boolean = true, // TODO reconsider this API, see `gro-adapter-node-library`
): Promise<void> => {
	const build_out_dir = to_build_out_path(dev, build_config.name);
	const externals_dir = to_build_out_path(dev, build_config.name, EXTERNALS_BUILD_DIRNAME);
	log.info(`copying ${print_path(build_out_dir)} to ${print_path(dist_out_dir)}`);
	const typemap_files: string[] = [];
	await fs.copy(build_out_dir, dist_out_dir, {
		overwrite: false, // TODO this was old, not sure anymore: prioritizes the artifacts from other build processes
		filter: async (id) => {
			if (id === externals_dir) return false;
			const stats = await fs.stat(id);
			if (filter && !filter(id, stats)) return false;
			if (stats.isDirectory()) return true;
			// typemaps are edited before copying, see below
			if (id.endsWith(TS_TYPEMAP_EXTENSION)) {
				typemap_files.push(id);
				return false;
			}
			return true;
		},
	});
	// typemap files (.d.ts.map) need their `sources` property mapped back to the source directory
	// based on the relative change from the build to the dist
	await Promise.all(
		typemap_files.map(async (id) => {
			const base_path = to_build_base_path(id);
			const source_base_path = `${strip_end(base_path, TS_TYPEMAP_EXTENSION)}${TS_EXTENSION}`;
			const dist_source_id = pack
				? `${dist_out_dir}/${SOURCE_DIRNAME}/${source_base_path}`
				: `${paths.source}${source_base_path}`;
			const dist_out_path = `${dist_out_dir}/${base_path}`;
			const typemap_source_path = relative(dirname(dist_out_path), dist_source_id);
			const typemap = JSON.parse(await fs.read_file(id, 'utf8'));
			typemap.sources[0] = typemap_source_path; // haven't seen any exceptions that would break this
			return fs.write_file(dist_out_path, JSON.stringify(typemap));
		}),
	);
};
