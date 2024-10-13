import {readFileSync} from 'node:fs';

/*

bleh SvelteKit's `$app/environment` isn't supported inside Vite:
    Cannot find package '$app' imported from /home/desk/dev/gro/vite.config.ts.timestamp-
import {SECRET_ANTHROPIC_API_KEY,	SECRET_OPENAI_API_KEY, SECRET_GOOGLE_API_KEY} from '$app/environment';

*/

const env_file_contents = readFileSync('./.env.development', 'utf8');

export const api_keys: {
	SECRET_ANTHROPIC_API_KEY: string;
	SECRET_OPENAI_API_KEY: string;
	SECRET_GOOGLE_API_KEY: string;
} = Object.fromEntries(env_file_contents.split('\n').map((l) => l.split('=')));
