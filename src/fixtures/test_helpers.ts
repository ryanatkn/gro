import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

export const SOME_PUBLIC_ENV_VAR_NAME = 'PUBLIC_SOME_PUBLIC_ENV_VAR';
export const SOME_PUBLIC_ENV_VAR_VALUE = 'SOME_PUBLIC_ENV_VAR';
const name_equals = SOME_PUBLIC_ENV_VAR_NAME + '=';
const line = name_equals + SOME_PUBLIC_ENV_VAR_VALUE;

let inited = false;

/**
 * Hacky global helper to init the test env.
 *
 * @returns boolean indicating if the env file was created or not
 */
export const init_test_env = (dir = process.cwd(), env_filename = '.env'): boolean => {
	if (inited) return false;
	inited = true;

	const env_file = join(dir, env_filename);

	if (!existsSync(env_file)) {
		writeFileSync(env_file, line + '\n', 'utf8');
		return true;
	}

	const contents = readFileSync(env_file, 'utf8');
	const lines = contents.split('\n');
	if (lines.includes(line)) {
		return false; // already exists
	}

	let new_contents: string;
	const found_index = lines.findIndex((l) => l.startsWith(name_equals));
	if (found_index === -1) {
		// if the line does not exist, add it
		new_contents = contents + (contents.endsWith('\n') ? '' : '\n') + line + '\n';
	} else {
		// if the line exists but with a different value, replace it
		new_contents = contents.replace(new RegExp(`${SOME_PUBLIC_ENV_VAR_NAME}=.*`), line);
	}
	writeFileSync(env_file, new_contents, 'utf8');

	return true;
};
