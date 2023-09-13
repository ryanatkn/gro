import type {Config} from '@sveltejs/kit';
import {join} from 'node:path';

export const load_sveltekit_config = async (dir: string): Promise<Config | null> => {
	try {
		return (await import(join(dir, 'svelte.config.js'))).default;
	} catch (err) {
		return null;
	}
};
