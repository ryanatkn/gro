import {relative, dirname} from 'path';
import type {Logger} from '@feltjs/util/log.js';
import {stripEnd, stripStart} from '@feltjs/util/string.js';

import type {BuildConfig} from '../build/buildConfig.js';
import type {Filesystem} from '../fs/filesystem.js';
import type {IdStatsFilter} from '../fs/filter.js';
import {
	toBuildBasePath,
	toBuildOutPath,
	TS_EXTENSION,
	TS_TYPEMAP_EXTENSION,
	printPath,
	SOURCE_DIRNAME,
	paths,
} from '../paths.js';

export const copyDist = async (
	fs: Filesystem,
	buildConfig: BuildConfig,
	dev: boolean,
	distOutDir: string,
	log: Logger,
	filter?: IdStatsFilter,
	pack = true, // TODO reconsider this API, see `gro-adapter-node-library`
	rebasePath = '',
): Promise<void> => {
	const buildOutDir = toBuildOutPath(dev, buildConfig.name, rebasePath);
	log.info(`copying ${printPath(buildOutDir)} to ${printPath(distOutDir)}`);
	const typemapFiles: string[] = [];
	await fs.copy(buildOutDir, distOutDir, {
		overwrite: false,
		filter: async (id) => {
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
			const basePath = toBuildBasePath(id);
			const sourceBasePath = `${stripEnd(basePath, TS_TYPEMAP_EXTENSION)}${TS_EXTENSION}`;
			const sourceId = `${SOURCE_DIRNAME}/${sourceBasePath}`;
			// TODO when the `pack` hack is removed, use `distSourceId` below instead of reconstructing it
			const distSourceId = pack ? `${distOutDir}/${sourceId}` : `${paths.source}${sourceBasePath}`;
			const distOutPath = `${distOutDir}/${stripStart(basePath, rebasePath)}`;
			const typemapSourcePath = relative(dirname(distOutPath), distSourceId);
			const typemap = JSON.parse(await fs.readFile(id, 'utf8'));
			typemap.sources[0] = typemapSourcePath; // haven't seen any exceptions that would break this
			return Promise.all([
				fs.copy(sourceId, `${distOutDir}/${sourceId}`), // copy source TypeScript files (but not other filetypes)
				fs.writeFile(distOutPath, JSON.stringify(typemap)),
			]);
		}),
	);
};

export type HostTarget = 'githubPages' | 'static' | 'node';

const NOJEKYLL_FILENAME = '.nojekyll';

// GitHub pages processes everything with Jekyll by default,
// breaking things like files and dirs prefixed with an underscore.
// This adds a `.nojekyll` file to the root of the output
// to tell GitHub Pages to treat the outputs as plain static files.
export const ensureNojekyll = async (fs: Filesystem, dir: string): Promise<void> => {
	const nojekyllPath = `${dir}/${NOJEKYLL_FILENAME}`;
	if (!(await fs.exists(nojekyllPath))) {
		await fs.writeFile(nojekyllPath, '', 'utf8');
	}
};

// GitHub fallback pages requires a `/404.html`,
// but SvelteKit currently builds to `/404/index.html`.
// This moves the file if it exists.
// TODO remove when fixed: https://github.com/sveltejs/kit/issues/1209
export const move404 = async (fs: Filesystem, dir: string): Promise<void> => {
	const missingPath = `${dir}/404`;
	if (await fs.exists(missingPath)) {
		await fs.move(`${missingPath}/index.html`, `${dir}/404.html`);
		await fs.remove(missingPath);
	}
};
