import {relative, dirname} from 'path';
import type {Logger} from '@feltcoop/felt/util/log.js';
import {strip_end, strip_start} from '@feltcoop/felt/util/string.js';

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
	TS_TYPE_EXTENSION,
	to_types_build_dir,
} from '../paths.js';

// TODO this has a huge hack to copy all types over to the dist because
// we're not including `import type` imports as dependencies yet

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
	const copied_type_files: Set<string> = new Set(); // TODO HACK -- see above, delete this
	const typemap_files: string[] = [];
	await fs.copy(build_out_dir, dist_out_dir, {
		filter: async (id) => {
			if (id === externals_dir) return false;
			const stats = await fs.stat(id);
			if (filter && !filter(id, stats)) return false;
			if (stats.isDirectory()) return true;
			// TODO HACK -- see above, delete this
			if (id.endsWith(TS_TYPE_EXTENSION) || id.endsWith(TS_TYPEMAP_EXTENSION)) {
				copied_type_files.add(id);
			}
			// typemaps are edited before copying, see below
			if (id.endsWith(TS_TYPEMAP_EXTENSION)) {
				typemap_files.push(id);
				return false;
			}
			return true;
		},
	});

	// TODO HACK -- see above, delete this
	const hack_typemap_files: string[] = [];
	if (copied_type_files.size) {
		await fs.copy(to_types_build_dir(), dist_out_dir, {
			filter: async (id) => {
				const stats = await fs.stat(id);
				if (filter && !filter(id, stats)) return false;
				if (stats.isDirectory()) return true;
				const should_copy = !copied_type_files.has(id);
				if (should_copy && id.endsWith(TS_TYPEMAP_EXTENSION)) {
					hack_typemap_files.push(id);
					return false;
				}
				return should_copy;
			},
		});
	}

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

	// TODO HACK -- see above, delete this
	await Promise.all(
		hack_typemap_files.map(async (id) => {
			const base_path = strip_start(id, to_types_build_dir()).substring(1);
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

export type Host_Target = 'github_pages' | 'static';

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
