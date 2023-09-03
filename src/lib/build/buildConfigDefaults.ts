import {createFilter} from '@rollup/pluginutils';

import type {BuildConfig, BuildName} from './buildConfig.js';
import {
	toBuildExtension,
	basePathToSourceId,
	LIB_DIR,
	LIB_DIRNAME,
	CONFIG_SOURCE_PATH,
} from '../path/paths.js';
import type {EcmaScriptTarget} from './helpers.js';
import type {Filesystem} from '../fs/filesystem.js';

export const DEFAULT_ECMA_SCRIPT_TARGET: EcmaScriptTarget = 'esnext';

export const GIT_DEPLOY_SOURCE_BRANCH = 'main'; // deploy and publish FROM this branch
export const GIT_DEPLOY_TARGET_BRANCH = 'deploy'; // deploy TO this branch

// Gro currently requires this system build config for Node tasks and tests.
// This convention speeds up running tasks by standardizing where Gro can look for built files.
// This restriction could be relaxed by using cached metadata, but this keeps things simple for now.
export const SYSTEM_BUILD_NAME: BuildName = 'system';
export const SYSTEM_BUILD_CONFIG: BuildConfig = {
	name: SYSTEM_BUILD_NAME,
	input: [
		createFilter([
			'**/' + CONFIG_SOURCE_PATH,
			'**/*.{task,test,gen,gen.*,schema}.ts',
			'**/fixtures/**',
		]),
	],
};

export const hasNodeLibrary = (fs: Filesystem): Promise<boolean> => fs.exists(LIB_DIR);

export const API_SERVER_SOURCE_BASE_PATH = LIB_DIRNAME + '/server/server.ts';
export const API_SERVER_BUILD_BASE_PATH = toBuildExtension(API_SERVER_SOURCE_BASE_PATH); // 'lib/server/server.js'
export const API_SERVER_SOURCE_ID = basePathToSourceId(API_SERVER_SOURCE_BASE_PATH); // '/home/to/your/src/lib/server/server.ts'
export const hasApiServer = (fs: Filesystem): Promise<boolean> => fs.exists(API_SERVER_SOURCE_ID);
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
export const hasSveltekitFrontend = (fs: Filesystem): Promise<boolean> =>
	everyPathExists(fs, SVELTEKIT_FRONTEND_PATHS);

const everyPathExists = async (fs: Filesystem, paths: string[]): Promise<boolean> =>
	(await Promise.all(paths.map((path) => fs.exists(path)))).every((v) => !!v);
