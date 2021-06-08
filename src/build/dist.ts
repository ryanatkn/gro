import {relative, dirname} from 'path';
import type {Logger} from '@feltcoop/felt/utils/log.js';
import {strip_end} from '@feltcoop/felt/utils/string.js';

import type {Build_Config} from '../build/build_config.js';
import type {Filesystem} from '../fs/filesystem.js';
import type {PathStats} from '../fs/pathData.js';
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

export const copyDist = async (
	fs: Filesystem,
	build_config: Build_Config,
	dev: boolean,
	distOutDir: string,
	log: Logger,
	filter?: (id: string, stats: PathStats) => boolean,
	pack: boolean = true, // TODO reconsider this API, see `gro-adapter-node-library`
): Promise<void> => {
	const buildOutDir = to_build_out_path(dev, build_config.name);
	const externalsDir = to_build_out_path(dev, build_config.name, EXTERNALS_BUILD_DIRNAME);
	log.info(`copying ${print_path(buildOutDir)} to ${print_path(distOutDir)}`);
	const typemapFiles: string[] = [];
	await fs.copy(buildOutDir, distOutDir, {
		overwrite: false, // TODO this was old, not sure anymore: prioritizes the artifacts from other build processes
		filter: async (id) => {
			if (id === externalsDir) return false;
			const stats = await fs.stat(id);
			if (filter && !filter(id, stats)) return false;
			if (stats.isDirectory()) return true;
			// typemaps are edited before copying, see below
			if (id.endsWith(TS_TYPEMAP_EXTENSION)) {
				typemapFiles.push(id);
				return false;
			}
			return true;
		},
	});
	// typemap files (.d.ts.map) need their `sources` property mapped back to the source directory
	// based on the relative change from the build to the dist
	await Promise.all(
		typemapFiles.map(async (id) => {
			const base_path = to_build_base_path(id);
			const sourceBasePath = `${strip_end(base_path, TS_TYPEMAP_EXTENSION)}${TS_EXTENSION}`;
			const distSourceId = pack
				? `${distOutDir}/${SOURCE_DIRNAME}/${sourceBasePath}`
				: `${paths.source}${sourceBasePath}`;
			const distOutPath = `${distOutDir}/${base_path}`;
			const typemapSourcePath = relative(dirname(distOutPath), distSourceId);
			const typemap = JSON.parse(await fs.readFile(id, 'utf8'));
			typemap.sources[0] = typemapSourcePath; // haven't seen any exceptions that would break this
			return fs.writeFile(distOutPath, JSON.stringify(typemap));
		}),
	);
};
