import {createFilter} from '@rollup/pluginutils';

import type {Build_Config, Build_Config_Partial, Build_Name} from './build_config.js';
import {to_build_extension, base_path_to_source_id, paths} from '../paths.js';
import {get_extensions} from '../fs/mime.js';
import type {Ecma_Script_Target} from '../build/ts_build_helpers.js';
import type {Filesystem} from '../fs/filesystem.js';

export const DEFAULT_ECMA_SCRIPT_TARGET: Ecma_Script_Target = 'es2020';

export const GIT_DEPLOY_BRANCH = 'main'; // deploy and publish from this branch

export const CONFIG_BUILD_NAME: Build_Name = 'config';
export const CONFIG_BUILD_CONFIG: Build_Config = {
	name: CONFIG_BUILD_NAME,
	platform: 'node',
	input: [`${paths.source}gro.config.ts`],
};

// Gro currently requires this system build config for Node tasks and tests.
// This convention speeds up running tasks by standardizing where Gro can look for built files.
// This restriction could be relaxed by using cached metadata, but this keeps things simple for now.
export const SYSTEM_BUILD_NAME: Build_Name = 'system';
export const SYSTEM_BUILD_CONFIG: Build_Config = {
	name: SYSTEM_BUILD_NAME,
	platform: 'node',
	input: [createFilter(['**/*.{task,test,gen,gen.*}.ts', '**/fixtures/**'])],
};

const NODE_LIBRARY_PATH = 'lib/index.ts';
const NODE_LIBRARY_SOURCE_ID = base_path_to_source_id(NODE_LIBRARY_PATH);
export const has_node_library = (fs: Filesystem): Promise<boolean> =>
	fs.exists(NODE_LIBRARY_SOURCE_ID);
export const NODE_LIBRARY_BUILD_NAME: Build_Name = 'library';
export const NODE_LIBRARY_BUILD_CONFIG: Build_Config = {
	name: NODE_LIBRARY_BUILD_NAME,
	platform: 'node',
	input: [NODE_LIBRARY_PATH],
};

export const API_SERVER_SOURCE_BASE_PATH = 'lib/server/server.ts';
export const API_SERVER_BUILD_BASE_PATH = to_build_extension(API_SERVER_SOURCE_BASE_PATH); // 'lib/server/server.js'
export const API_SERVER_SOURCE_ID = base_path_to_source_id(API_SERVER_SOURCE_BASE_PATH); // '/home/to/your/src/lib/server/server.ts'
export const has_api_server = (fs: Filesystem): Promise<boolean> => fs.exists(API_SERVER_SOURCE_ID);
export const API_SERVER_BUILD_NAME: Build_Name = 'server';
export const API_SERVER_BUILD_CONFIG: Build_Config = {
	name: API_SERVER_BUILD_NAME,
	platform: 'node',
	input: [API_SERVER_SOURCE_BASE_PATH],
};
// the first of these matches SvelteKit, the second is just close for convenience
// TODO change to remove the second, search upwards for an open port
export const API_SERVER_DEFAULT_PORT_PROD = 3000;
export const API_SERVER_DEFAULT_PORT_DEV = 3001;
export const to_api_server_port = (dev: boolean): number =>
	dev ? API_SERVER_DEFAULT_PORT_DEV : API_SERVER_DEFAULT_PORT_PROD;

const SVELTEKIT_FRONTEND_PATHS = ['src/app.html', 'src/routes'];
export const has_sveltekit_frontend = (fs: Filesystem): Promise<boolean> =>
	everyPathExists(fs, SVELTEKIT_FRONTEND_PATHS);

const DEPRECATED_GRO_FRONTEND_PATHS = ['src/index.html', 'src/index.ts'];
export const has_deprecated_gro_frontend = (fs: Filesystem): Promise<boolean> =>
	everyPathExists(fs, DEPRECATED_GRO_FRONTEND_PATHS);

export const BROWSER_BUILD_NAME: Build_Name = 'browser';
export const toDefaultBrowserBuild = (
	assetPaths = toDefaultAssetPaths(),
): Build_Config_Partial => ({
	name: BROWSER_BUILD_NAME,
	platform: 'browser',
	input: ['index.ts', createFilter(`**/*.{${assetPaths.join(',')}}`)],
});
const toDefaultAssetPaths = (): string[] => Array.from(get_extensions());

const everyPathExists = async (fs: Filesystem, paths: string[]): Promise<boolean> =>
	(await Promise.all(paths.map((path) => fs.exists(path)))).every((v) => !!v);
