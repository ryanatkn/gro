import {createFilter} from '@rollup/pluginutils';

import type {BuildConfig, BuildConfigPartial, BuildName} from 'src/build/build_config.js';
import {
	to_build_extension,
	base_path_to_source_id,
	paths,
	JS_EXTENSION,
	JSON_EXTENSION,
	TS_EXTENSION,
	SVELTE_EXTENSION,
} from '../paths.js';
import {get_extensions} from '../fs/mime.js';
import type {EcmaScriptTarget} from 'src/build/typescript_utils.js';
import type {Filesystem} from 'src/fs/filesystem.js';

export const DEFAULT_ECMA_SCRIPT_TARGET: EcmaScriptTarget = 'es2020';

export const GIT_DEPLOY_BRANCH = 'main'; // deploy and publish from this branch

export const CONFIG_BUILD_NAME: BuildName = 'config';
export const CONFIG_BUILD_CONFIG: BuildConfig = {
	name: CONFIG_BUILD_NAME,
	platform: 'node',
	input: [`${paths.source}gro.config.ts`],
};

// Gro currently requires this system build config for Node tasks and tests.
// This convention speeds up running tasks by standardizing where Gro can look for built files.
// This restriction could be relaxed by using cached metadata, but this keeps things simple for now.
export const SYSTEM_BUILD_NAME: BuildName = 'system';
export const SYSTEM_BUILD_CONFIG: BuildConfig = {
	name: SYSTEM_BUILD_NAME,
	platform: 'node',
	input: [createFilter(['**/*.{task,test,gen,gen.*}.ts', '**/fixtures/**'])],
};

const NODE_LIBRARY_PATH = 'lib/index.ts';
const NODE_LIBRARY_SOURCE_ID = base_path_to_source_id(NODE_LIBRARY_PATH);
export const has_node_library = (fs: Filesystem): Promise<boolean> =>
	fs.exists(NODE_LIBRARY_SOURCE_ID);
export const NODE_LIBRARY_BUILD_NAME: BuildName = 'library';
export const NODE_LIBRARY_BUILD_CONFIG: BuildConfig = {
	name: NODE_LIBRARY_BUILD_NAME,
	platform: 'node',
	input: [NODE_LIBRARY_PATH],
};

export const API_SERVER_SOURCE_BASE_PATH = 'lib/server/server.ts';
export const API_SERVER_BUILD_BASE_PATH = to_build_extension(API_SERVER_SOURCE_BASE_PATH, false); // 'lib/server/server.js'
export const API_SERVER_SOURCE_ID = base_path_to_source_id(API_SERVER_SOURCE_BASE_PATH); // '/home/to/your/src/lib/server/server.ts'
export const has_api_server = (fs: Filesystem): Promise<boolean> => fs.exists(API_SERVER_SOURCE_ID);
export const API_SERVER_BUILD_NAME: BuildName = 'server';
export const API_SERVER_BUILD_CONFIG: BuildConfig = {
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
	every_path_exists(fs, SVELTEKIT_FRONTEND_PATHS);

const GRO_FRONTEND_PATHS = ['src/index.html', 'src/index.ts'];
export const has_gro_frontend = (fs: Filesystem): Promise<boolean> =>
	every_path_exists(fs, GRO_FRONTEND_PATHS);

export const BROWSER_BUILD_NAME: BuildName = 'browser';
export const to_default_browser_build = (
	asset_extensions = to_default_asset_extensions(),
): BuildConfigPartial => ({
	name: BROWSER_BUILD_NAME,
	platform: 'browser',
	input: ['index.ts', createFilter(`**/*.{${asset_extensions.join(',')}}`)],
});

// Compute default asset extensions on demand to pick up any changes to the supported MIME types.
// Like the MIME type extensions and unlike elsewhere, these are not prefixed with `.` !!
export const to_default_asset_extensions = (): string[] =>
	Array.from(get_extensions()).filter(
		(extension) => !default_non_asset_extensions.has(`.${extension}`),
	);

export const default_non_asset_extensions = new Set([
	JS_EXTENSION,
	JSON_EXTENSION,
	TS_EXTENSION,
	SVELTE_EXTENSION,
]);

const every_path_exists = async (fs: Filesystem, paths: string[]): Promise<boolean> =>
	(await Promise.all(paths.map((path) => fs.exists(path)))).every((v) => !!v);
