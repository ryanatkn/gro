import {spawn} from '@feltcoop/felt/util/process.js';

import {SVELTEKIT_TSCONFIG} from '../paths.js';
import type {Filesystem} from '../fs/filesystem';

// TODO maybe always call sync without checking first?
export const sveltekitSync = async (fs: Filesystem): Promise<void> => {
	if (!(await fs.exists(SVELTEKIT_TSCONFIG))) {
		const syncResult = await spawn('npx', ['svelte-kit', 'sync']);
		if (!syncResult.ok) {
			throw new Error(`Failed to call 'svelte-kit sync'.`);
		}
	}
};
