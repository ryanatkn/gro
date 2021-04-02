import {createFilter} from '@rollup/pluginutils';

import type {BuildConfig, PartialBuildConfig} from './buildConfig.js';
import {SERVER_SOURCE_BASE_PATH, SERVER_SOURCE_ID} from '../paths.js';
import {pathExists} from '../fs/nodeFs.js';

// Gro currently enforces that the primary build config
// for the Node platform has this value as its name.
// This convention speeds up running tasks by standardizing where Gro can look for built files.
// This restriction could be relaxed by using cached metadata, but this keeps things simple for now.
export const PRIMARY_BUILD_CONFIG_NAME = 'node';
export const PRIMARY_NODE_BUILD_CONFIG: BuildConfig = {
	name: PRIMARY_BUILD_CONFIG_NAME,
	platform: 'node',
	primary: true,
	dist: false,
	input: [createFilter(['**/*.{task,test,config,gen}*.ts', '**/fixtures/**'])],
};

export const hasGroServer = (): Promise<boolean> => pathExists(SERVER_SOURCE_ID);
export const SERVER_BUILD_CONFIG_NAME = 'server';
export const SERVER_BUILD_CONFIG: BuildConfig = {
	name: SERVER_BUILD_CONFIG_NAME,
	platform: 'node',
	primary: false,
	dist: true,
	input: [SERVER_SOURCE_BASE_PATH],
};

export const hasDeprecatedGroFrontend = async (): Promise<boolean> => {
	const [hasIndexHtml, hasIndexTs] = await Promise.all([
		pathExists('src/index.html'),
		pathExists('src/index.ts'),
	]);
	return hasIndexHtml && hasIndexTs;
};
const assetPaths = ['html', 'css', 'json', 'ico', 'png', 'jpg', 'webp', 'webm', 'mp3'];
export const toDefaultBrowserBuild = (): PartialBuildConfig => ({
	name: 'browser',
	platform: 'browser',
	input: ['index.ts', createFilter(`**/*.{${assetPaths.join(',')}}`)],
	dist: true,
});
