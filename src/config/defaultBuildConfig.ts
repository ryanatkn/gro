import {createFilter} from '@rollup/pluginutils';

import type {BuildConfig, PartialBuildConfig} from './buildConfig.js';
import {toBuildExtension, basePathToSourceId, toBuildOutPath, DIST_DIR_NAME} from '../paths.js';
import {pathExists} from '../fs/nodeFs.js';

// Gro currently enforces that the primary build config
// for the Node platform has this value as its name.
// This convention speeds up running tasks by standardizing where Gro can look for built files.
// This restriction could be relaxed by using cached metadata, but this keeps things simple for now.
export const PRIMARY_NODE_BUILD_CONFIG_NAME = 'node';
export const PRIMARY_NODE_BUILD_CONFIG: BuildConfig = {
	name: PRIMARY_NODE_BUILD_CONFIG_NAME,
	platform: 'node',
	primary: true,
	dist: false,
	input: [createFilter(['**/*.{task,test,config,gen}*.ts', '**/fixtures/**'])],
};

export const API_SERVER_SOURCE_BASE_PATH = 'server/server.ts';
export const API_SERVER_BUILD_BASE_PATH = toBuildExtension(API_SERVER_SOURCE_BASE_PATH); // 'server/server.js'
export const API_SERVER_SOURCE_ID = basePathToSourceId(API_SERVER_SOURCE_BASE_PATH); // '/home/to/your/src/server/server.ts'
// export const API_SERVER_DIST_ROOT_PATH = `${DIST_DIR_NAME}/server.js`; // TODO calculate this, how? should we change the server build out?
export const hasApiServer = (): Promise<boolean> => pathExists(API_SERVER_SOURCE_ID);
export const hasApiServerConfig = (buildConfigs: BuildConfig[]): boolean =>
	buildConfigs.some(
		(b) =>
			b.name === API_SERVER_BUILD_CONFIG_NAME && b.platform === API_SERVER_BUILD_CONFIG_PLATFORM,
	);
export const API_SERVER_BUILD_CONFIG_NAME = 'server';
export const API_SERVER_BUILD_CONFIG_PLATFORM = 'node';
export const API_SERVER_BUILD_CONFIG: BuildConfig = {
	name: API_SERVER_BUILD_CONFIG_NAME,
	platform: API_SERVER_BUILD_CONFIG_PLATFORM,
	primary: false,
	dist: true,
	input: [API_SERVER_SOURCE_BASE_PATH],
};
// the first of these matches SvelteKit, the second is just close for convenience
export const API_SERVER_DEFAULT_PORT_DEV = 3000;
export const API_SERVER_DEFAULT_PORT_PROD = 3001;
export const toApiServerBuildPath = (dev: boolean): string =>
	toBuildOutPath(dev, API_SERVER_BUILD_CONFIG_NAME, API_SERVER_BUILD_BASE_PATH);

export const hasDeprecatedGroFrontend = async (): Promise<boolean> => {
	const [hasIndexHtml, hasIndexTs] = await Promise.all([
		pathExists('src/index.html'),
		pathExists('src/index.ts'),
	]);
	return hasIndexHtml && hasIndexTs;
};
const DEFAULT_ASSET_PATHS = ['html', 'css', 'json', 'ico', 'png', 'jpg', 'webp', 'webm', 'mp3'];
export const toDefaultBrowserBuild = (assetPaths = DEFAULT_ASSET_PATHS): PartialBuildConfig => ({
	name: 'browser',
	platform: 'browser',
	input: ['index.ts', createFilter(`**/*.{${assetPaths.join(',')}}`)],
	dist: true,
});
