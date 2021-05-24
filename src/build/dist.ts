import {relative, dirname} from 'path';

import type {BuildConfig} from '../build/buildConfig.js';
import type {Filesystem} from '../fs/filesystem.js';
import {
	basePathToSourceId,
	EXTERNALS_BUILD_DIRNAME,
	toBuildBasePath,
	toBuildOutPath,
	TS_TYPEMAP_EXTENSION,
} from '../paths.js';
import type {Logger} from '../utils/log.js';
import {printPath} from '../utils/print.js';

export const copyDist = async (
	fs: Filesystem,
	buildConfig: BuildConfig,
	dev: boolean,
	distOutDir: string,
	log: Logger,
	filter?: (id: string) => boolean,
): Promise<void> => {
	const buildOutDir = toBuildOutPath(dev, buildConfig.name);
	const externalsDir = toBuildOutPath(dev, buildConfig.name, EXTERNALS_BUILD_DIRNAME);
	log.info(`copying ${printPath(buildOutDir)} to ${printPath(distOutDir)}`);
	const typemapFiles: string[] = [];
	await fs.copy(buildOutDir, distOutDir, {
		overwrite: false, // TODO this was old, not sure anymore: prioritizes the artifacts from other build processes
		filter: async (id) => {
			if (id === externalsDir) return false;
			if (filter && !filter(id)) return false;
			const stats = await fs.stat(id);
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
			const basePath = toBuildBasePath(id);
			const sourceId = basePathToSourceId(basePath);
			const distOutPath = `${distOutDir}/${basePath}`;
			const typemapSourcePath = relative(dirname(distOutPath), sourceId);
			const typemap = JSON.parse(await fs.readFile(id, 'utf8'));
			typemap.sources[0] = typemapSourcePath; // haven't seen any exceptions that would break this
			return fs.writeFile(distOutPath, JSON.stringify(typemap));
		}),
	);
};
