import {createFilter} from '@rollup/pluginutils';

import type {GroConfigCreator, PartialGroConfig} from './config.js';
import {LogLevel} from '../utils/log.js';
import {PartialBuildConfig} from './buildConfig.js';
import {pathExists} from '../fs/nodeFs.js';

// This is the default config that's used if the current project does not define one.

const createConfig: GroConfigCreator = async () => {
	const config: PartialGroConfig = {
		builds: [
			(await hasDeprecatedGroFrontend()) ? toDefaultBrowserBuild() : null,
			{
				name: 'node',
				platform: 'node',
				input: [createFilter('**/*.{task,test,config,gen}*.ts')],
			},
		],
		logLevel: LogLevel.Trace,
	};
	return config;
};

export default createConfig;

const assetPaths = ['html', 'css', 'json', 'ico', 'png', 'jpg', 'webp', 'webm', 'mp3'];

const toDefaultBrowserBuild = (): PartialBuildConfig => ({
	name: 'browser',
	platform: 'browser',
	input: ['index.ts', createFilter(`**/*.{${assetPaths.join(',')}}`)],
	dist: true,
});

// TODO extract helper?
const hasDeprecatedGroFrontend = async (): Promise<boolean> => {
	const [hasIndexHtml, hasIndexTs] = await Promise.all([
		pathExists('src/index.html'),
		pathExists('src/index.ts'),
	]);
	return hasIndexHtml && hasIndexTs;
};
