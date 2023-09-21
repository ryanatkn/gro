import {stripEnd} from '@feltjs/util/string.js';
import {mkdir, writeFile} from 'node:fs/promises';

import type {Adapter} from './adapt.js';
import {SVELTEKIT_BUILD_DIRNAME} from './paths.js';
import {exists} from './exists.js';

export interface Options {
	dir?: string;
	/**
	 * Used for finalizing a SvelteKit build like adding a `.nojekyll` file for GitHub Pages.
	 * @default 'github_pages'
	 */
	host_target?: HostTarget;
}

export type HostTarget = 'github_pages' | 'static' | 'node';

export const create_adapter = ({
	dir = SVELTEKIT_BUILD_DIRNAME,
	host_target = 'github_pages',
}: Options = {}): Adapter => {
	const output_dir = stripEnd(dir, '/');
	return {
		name: 'gro_adapter_sveltekit_frontend',
		adapt: async () => {
			if (host_target === 'github_pages') {
				await Promise.all([ensure_nojekyll(output_dir)]);
			}
		},
	};
};

const NOJEKYLL_FILENAME = '.nojekyll';

/**
 * GitHub pages processes everything with Jekyll by default,
 * breaking things like files and dirs prefixed with an underscore.
 * This adds a `.nojekyll` file to the root of the output
 * to tell GitHub Pages to treat the outputs as plain static files.
 */
const ensure_nojekyll = async (dir: string): Promise<void> => {
	const path = `${dir}/${NOJEKYLL_FILENAME}`;
	if (!(await exists(path))) {
		await mkdir(dir, {recursive: true});
		await writeFile(path, '', 'utf8');
	}
};
