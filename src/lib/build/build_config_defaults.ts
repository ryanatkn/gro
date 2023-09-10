import {existsSync} from 'node:fs';

import type {BuildConfig, BuildName} from './build_config.js';
import {to_build_extension, base_path_to_source_id, LIB_DIR, LIB_DIRNAME} from '../path/paths.js';

export const GIT_DEPLOY_SOURCE_BRANCH = 'main'; // deploy and publish FROM this branch
export const GIT_DEPLOY_TARGET_BRANCH = 'deploy'; // deploy TO this branch

export const has_node_library = (): boolean => existsSync(LIB_DIR);

export const NODE_SERVER_SOURCE_BASE_PATH = LIB_DIRNAME + '/server/server.ts';
export const NODE_SERVER_BUILD_BASE_PATH = to_build_extension(NODE_SERVER_SOURCE_BASE_PATH); // 'lib/server/server.js'
export const NODE_SERVER_SOURCE_ID = base_path_to_source_id(NODE_SERVER_SOURCE_BASE_PATH); // '/home/to/your/src/lib/server/server.ts'
export const has_node_server = (): boolean => existsSync(NODE_SERVER_SOURCE_ID);
export const NODE_SERVER_BUILD_NAME: BuildName = 'server';
export const NODE_SERVER_BUILD_CONFIG: BuildConfig = {
	name: NODE_SERVER_BUILD_NAME,
	input: [NODE_SERVER_SOURCE_BASE_PATH],
};

const SVELTEKIT_FRONTEND_PATHS = ['src/app.html', 'src/routes'];
export const has_sveltekit_frontend = (): boolean => every_path_exists(SVELTEKIT_FRONTEND_PATHS);

const every_path_exists = (paths: string[]): boolean => paths.every((path) => existsSync(path));
