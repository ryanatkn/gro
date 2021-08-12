import {relative, dirname} from 'path';
import type {Logger} from '@feltcoop/felt/util/log.js';
import {strip_end, strip_start} from '@feltcoop/felt/util/string.js';

import type {BuildConfig} from 'src/build/build_config.js';
import type {Filesystem} from 'src/fs/filesystem.js';
import type {IdStatsFilter} from 'src/fs/filter.js';
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

export const copy_dist = async (
	fs: Filesystem,
	build_config: BuildConfig,
	dev: boolean,
	dist_out_dir: string,
	log: Logger,
	filter?: IdStatsFilter,
	pack: boolean = true, // TODO reconsider this API, see `gro_adapter_node_library`
	rebase_path: string = '',
): Promise<void> => {
	const build_out_dir = to_build_out_path(dev, build_config.name, rebase_path);
	const externals_dir = build_out_dir + EXTERNALS_BUILD_DIRNAME;
	log.info(`copying ${print_path(build_out_dir)} to ${print_path(dist_out_dir)}`);
	const typemap_files: string[] = [];
	await fs.copy(build_out_dir, dist_out_dir, {
		overwrite: false,
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
			const dist_out_path = `${dist_out_dir}/${strip_start(base_path, rebase_path)}`;
			const typemap_source_path = relative(dirname(dist_out_path), dist_source_id);
			const typemap = JSON.parse(await fs.read_file(id, 'utf8'));
			typemap.sources[0] = typemap_source_path; // haven't seen any exceptions that would break this
			return fs.write_file(dist_out_path, JSON.stringify(typemap));
		}),
	);
};

export type HostTarget = 'github_pages' | 'static';

const NOJEKYLL_FILENAME = '.nojekyll';

// GitHub pages processes everything with Jekyll by default,
// breaking things like files and dirs prefixed with an underscore.
// This adds a `.nojekyll` file to the root of the output
// to tell GitHub Pages to treat the outputs as plain static files.
export const ensure_nojekyll = async (fs: Filesystem, dir: string): Promise<void> => {
	const nojekyll_path = `${dir}/${NOJEKYLL_FILENAME}`;
	if (!(await fs.exists(nojekyll_path))) {
		await fs.write_file(nojekyll_path, '', 'utf8');
	}
};
