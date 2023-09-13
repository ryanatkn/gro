import type {Config} from '@sveltejs/kit';
import {join} from 'node:path';
import {cwd} from 'node:process';

export const load_sveltekit_config = async (dir: string = cwd()): Promise<Config | null> => {
	try {
		console.log(`join(dir, 'svelte.config.js')`, join(dir, 'svelte.config.js'));
		return (await import(join(dir, 'svelte.config.js'))).default;
	} catch (err) {
		console.log(`err`, err);
		return null;
	}
};
