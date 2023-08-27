import type {Logger} from '@feltjs/util/log.js';

import type {BuildConfig} from '../build/buildConfig.js';
import type {Filesystem} from '../fs/filesystem.js';
import type {IdStatsFilter} from '../fs/filter.js';
import {toBuildOutPath, printPath} from '../path/paths.js';

export const copyDist = async (
	fs: Filesystem,
	buildConfig: BuildConfig,
	dev: boolean,
	distOutDir: string,
	log: Logger,
	filter?: IdStatsFilter,
	rebasePath = '',
): Promise<void> => {
	const buildOutDir = toBuildOutPath(dev, buildConfig.name, rebasePath);
	log.info(`copying ${printPath(buildOutDir)} to ${printPath(distOutDir)}`);
	await fs.copy(buildOutDir, distOutDir, {
		overwrite: false,
		filter: async (id) => {
			const stats = await fs.stat(id);
			if (filter && !filter(id, stats)) return false;
			return true;
		},
	});
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
	const indexPath = `${missingPath}/index.html`;
	if (await fs.exists(indexPath)) {
		await fs.move(indexPath, `${dir}/404.html`);
		await fs.remove(missingPath);
	}
};
