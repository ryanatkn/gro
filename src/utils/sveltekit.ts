import {unwrap} from '@feltcoop/felt';
import {spawn} from '@feltcoop/felt/util/process.js';

export const sveltekitSync = async (): Promise<void> => {
	unwrap(await spawn('npx', ['svelte-kit', 'sync']), 'failed svelte-kit sync');
};
