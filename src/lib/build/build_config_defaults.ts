import type {BuildConfig, BuildName} from './build_config.js';
import {to_build_extension, base_path_to_source_id, LIB_DIR, LIB_DIRNAME} from '../path/paths.js';
import type {EcmaScriptTarget} from './helpers.js';
import type {Filesystem} from '../fs/filesystem.js';

export const DEFAULT_ECMA_SCRIPT_TARGET: EcmaScriptTarget = 'esnext';

export const GIT_DEPLOY_SOURCE_BRANCH = 'main'; // deploy and publish FROM this branch
export const GIT_DEPLOY_TARGET_BRANCH = 'deploy'; // deploy TO this branch

export const has_node_library = (fs: Filesystem): Promise<boolean> => fs.exists(LIB_DIR);

export const API_SERVER_SOURCE_BASE_PATH = LIB_DIRNAME + '/server/server.ts';
export const API_SERVER_BUILD_BASE_PATH = to_build_extension(API_SERVER_SOURCE_BASE_PATH); // 'lib/server/server.js'
export const API_SERVER_SOURCE_ID = base_path_to_source_id(API_SERVER_SOURCE_BASE_PATH); // '/home/to/your/src/lib/server/server.ts'
export const has_node_server = (fs: Filesystem): Promise<boolean> =>
	fs.exists(API_SERVER_SOURCE_ID);
export const API_SERVER_BUILD_NAME: BuildName = 'server';
export const API_SERVER_BUILD_CONFIG: BuildConfig = {
	name: API_SERVER_BUILD_NAME,
	input: [API_SERVER_SOURCE_BASE_PATH],
};
// the first of these matches SvelteKit, the second is just close for convenience
// TODO change to remove the second, search upwards for an open port
export const API_SERVER_DEFAULT_PORT_PROD = 3000;
export const API_SERVER_DEFAULT_PORT_DEV = 3001;
export const toApiServerPort = (dev: boolean): number =>
	dev ? API_SERVER_DEFAULT_PORT_DEV : API_SERVER_DEFAULT_PORT_PROD;

const SVELTEKIT_FRONTEND_PATHS = ['src/app.html', 'src/routes'];
export const has_sveltekit_frontend = (fs: Filesystem): Promise<boolean> =>
	everyPathExists(fs, SVELTEKIT_FRONTEND_PATHS);

const everyPathExists = async (fs: Filesystem, paths: string[]): Promise<boolean> =>
	(await Promise.all(paths.map((path) => fs.exists(path)))).every((v) => !!v);
