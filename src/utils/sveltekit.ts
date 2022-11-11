import {spawn, unwrap} from '@feltcoop/util';

import type {Filesystem} from '../fs/filesystem.js';

export const sveltekitSync = async (fs: Filesystem): Promise<void> => {
	if (!(await fs.exists('node_modules/.bin/svelte-kit'))) {
		return;
	}
	unwrap(await spawn('npx', ['svelte-kit', 'sync']), 'failed svelte-kit sync');
};
