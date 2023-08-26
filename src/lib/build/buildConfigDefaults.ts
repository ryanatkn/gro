import {createFilter} from '@rollup/pluginutils';

import type {BuildConfig, BuildName} from './buildConfig.js';
import {
	toBuildExtension,
	basePathToSourceId,
	paths,
	JS_EXTENSION,
	JSON_EXTENSION,
	TS_EXTENSION,
	SVELTE_EXTENSION,
	LIB_DIR,
	LIB_DIRNAME,
} from '../path/paths.js';
import {getExtensions} from '../fs/mime.js';
import type {EcmaScriptTarget} from './typescriptUtils.js';
import type {Filesystem} from '../fs/filesystem.js';

export const DEFAULT_ECMA_SCRIPT_TARGET: EcmaScriptTarget = 'es2020';

export const GIT_DEPLOY_SOURCE_BRANCH = 'main'; // deploy and publish FROM this branch
export const GIT_DEPLOY_TARGET_BRANCH = 'deploy'; // deploy TO this branch

export const CONFIG_BUILD_NAME: BuildName = 'config';
export const CONFIG_BUILD_CONFIG: BuildConfig = {
	name: CONFIG_BUILD_NAME,
	platform: 'node',
	input: [paths.source + 'gro.config.ts'],
	types: false,
};

// Gro currently requires this system build config for Node tasks and tests.
// This convention speeds up running tasks by standardizing where Gro can look for built files.
// This restriction could be relaxed by using cached metadata, but this keeps things simple for now.
export const SYSTEM_BUILD_NAME: BuildName = 'system';
export const SYSTEM_BUILD_CONFIG: BuildConfig = {
	name: SYSTEM_BUILD_NAME,
	platform: 'node',
	input: [createFilter(['**/*.{task,test,gen,gen.*,schema}.ts', '**/fixtures/**'])],
	types: false,
};

export const hasNodeLibrary = (fs: Filesystem): Promise<boolean> => fs.exists(LIB_DIR);

export const API_SERVER_SOURCE_BASE_PATH = LIB_DIRNAME + '/server/server.ts';
export const API_SERVER_BUILD_BASE_PATH = toBuildExtension(API_SERVER_SOURCE_BASE_PATH, false); // 'lib/server/server.js'
export const API_SERVER_SOURCE_ID = basePathToSourceId(API_SERVER_SOURCE_BASE_PATH); // '/home/to/your/src/lib/server/server.ts'
export const hasApiServer = (fs: Filesystem): Promise<boolean> => fs.exists(API_SERVER_SOURCE_ID);
export const API_SERVER_BUILD_NAME: BuildName = 'server';
export const API_SERVER_BUILD_CONFIG: BuildConfig = {
	name: API_SERVER_BUILD_NAME,
	platform: 'node',
	input: [API_SERVER_SOURCE_BASE_PATH],
	types: false,
};
// the first of these matches SvelteKit, the second is just close for convenience
// TODO change to remove the second, search upwards for an open port
export const API_SERVER_DEFAULT_PORT_PROD = 3000;
export const API_SERVER_DEFAULT_PORT_DEV = 3001;
export const toApiServerPort = (dev: boolean): number =>
	dev ? API_SERVER_DEFAULT_PORT_DEV : API_SERVER_DEFAULT_PORT_PROD;

const SVELTEKIT_FRONTEND_PATHS = ['src/app.html', 'src/routes'];
export const hasSveltekitFrontend = (fs: Filesystem): Promise<boolean> =>
	everyPathExists(fs, SVELTEKIT_FRONTEND_PATHS);

// Compute default asset extensions on demand to pick up any changes to the supported MIME types.
// Like the MIME type extensions and unlike elsewhere, these are not prefixed with `.` !!
export const toDefaultAssetExtensions = (): string[] =>
	Array.from(getExtensions()).filter(
		(extension) => !defaultNonAssetExtensions.has(`.${extension}`),
	);

export const defaultNonAssetExtensions = new Set([
	JS_EXTENSION,
	JSON_EXTENSION,
	TS_EXTENSION,
	SVELTE_EXTENSION,
]);

const everyPathExists = async (fs: Filesystem, paths: string[]): Promise<boolean> =>
	(await Promise.all(paths.map((path) => fs.exists(path)))).every((v) => !!v);
