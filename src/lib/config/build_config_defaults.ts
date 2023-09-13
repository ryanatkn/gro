import type {BuildConfig, BuildName} from './build_config.js';
import {base_path_to_source_id, LIB_DIR, LIB_DIRNAME} from '../path/paths.js';
import {exists} from '../util/exists.js';

export const GIT_DEPLOY_SOURCE_BRANCH = 'main'; // deploy and publish FROM this branch
export const GIT_DEPLOY_TARGET_BRANCH = 'deploy'; // deploy TO this branch

export const has_library = (): Promise<boolean> => exists(LIB_DIR);

export const has_server = (): Promise<boolean> => exists(SERVER_SOURCE_ID);
export const SERVER_SOURCE_BASE_PATH = LIB_DIRNAME + '/server/server.ts';
export const SERVER_BUILD_BASE_PATH = 'server/server.js'; // TODO BLOCK refactor, maybe compute this
export const SERVER_SOURCE_ID = base_path_to_source_id(SERVER_SOURCE_BASE_PATH); // '/home/to/your/src/lib/server/server.ts'
export const SERVER_BUILD_NAME: BuildName = 'server';
export const SERVER_BUILD_CONFIG: BuildConfig = {
	name: SERVER_BUILD_NAME,
	input: [SERVER_SOURCE_BASE_PATH],
};

export const has_sveltekit_frontend = (): Promise<boolean> =>
	every_path_exists(SVELTEKIT_FRONTEND_PATHS);
const SVELTEKIT_FRONTEND_PATHS = ['src/app.html', 'src/routes'];

const every_path_exists = async (paths: string[]): Promise<boolean> => {
	const p = await Promise.all(paths.map((path) => exists(path)));
	return p.every(Boolean);
};
