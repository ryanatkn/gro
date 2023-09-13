import type {Logger} from '@feltjs/util/log.js';
import {cpSync, mkdirSync, statSync, writeFileSync} from 'node:fs';

import type {BuildConfig} from '../config/build_config.js';
import type {PathFilter} from '../path/path.js';
import {to_build_out_path, print_path} from '../path/paths.js';
import {exists} from '../util/exists.js';

export const copy_dist = (
	build_config: BuildConfig,
	dist_out_dir: string,
	log: Logger,
	filter?: PathFilter,
	rebase_path = '',
): void => {
	// TODO BLOCK remove this? see its comments
	const build_out_dir = to_build_out_path(build_config.name, rebase_path);
	log.info(`copying ${print_path(build_out_dir)} to ${print_path(dist_out_dir)}`);
	cpSync(build_out_dir, dist_out_dir, {
		force: false,
		recursive: true,
		filter: (id) => {
			const stats = statSync(id);
			if (filter && !filter(id, stats)) return false;
			return true;
		},
	});
};

export type HostTarget = 'github_pages' | 'static' | 'node';

const NOJEKYLL_FILENAME = '.nojekyll';

// GitHub pages processes everything with Jekyll by default,
// breaking things like files and dirs prefixed with an underscore.
// This adds a `.nojekyll` file to the root of the output
// to tell GitHub Pages to treat the outputs as plain static files.
export const ensure_nojekyll = async (dir: string): Promise<void> => {
	const path = `${dir}/${NOJEKYLL_FILENAME}`;
	if (!(await exists(path))) {
		mkdirSync(dir, {recursive: true});
		writeFileSync(path, '', 'utf8');
	}
};
