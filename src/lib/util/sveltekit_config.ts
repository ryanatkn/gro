import type {Config} from '@sveltejs/kit';

export const load_sveltekit_config = async (dir: string): Promise<Config | null> => {
	try {
		return (await import(dir + 'svelte.config.js')).default;
	} catch (err) {
		return null;
	}
};
