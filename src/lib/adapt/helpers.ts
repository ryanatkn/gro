import type {Logger} from '@feltjs/util/log.js';
import {cpSync, existsSync, mkdirSync, statSync, writeFileSync} from 'node:fs';

import type {BuildConfig} from '../config/build_config.js';
import type {IdStatsFilter} from '../util/filter.js';
import {to_build_out_path, print_path} from '../path/paths.js';

export const copy_dist = (
	build_config: BuildConfig,
	dev: boolean,
	dist_out_dir: string,
	log: Logger,
	filter?: IdStatsFilter,
	rebase_path = '',
): void => {
	const build_out_dir = to_build_out_path(dev, build_config.name, rebase_path);
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
export const ensure_nojekyll = (dir: string): void => {
	const path = `${dir}/${NOJEKYLL_FILENAME}`;
	if (!existsSync(path)) {
		mkdirSync(dir, {recursive: true});
		writeFileSync(path, '', 'utf8');
	}
};
