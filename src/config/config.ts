import {join} from 'path';
import {existsSync} from 'fs';

import {paths, toSourceId} from '../paths.js';
import {BuildConfig} from './buildConfig.js';
import {Logger, SystemLogger} from '../utils/log.js';
import {magenta} from '../colors/terminal.js';

/*

The Gro config lets dependent projects define a config file
at `gro.config.ts` in either `src/` or `src/project`.
If none is provided, the fallback located in this project at `./gro.config.ts` is used.

*/

// TODO should `dev` be on the config?

const dev = process.env.NODE_ENV === 'development'; // TODO what's the right way to do this?

// See `./gro.config.ts` for documentation.
export interface GroConfig {
	buildConfigs: BuildConfig[]; // TODO maybe rename to `builds`?
}

export interface CreateGroConfigModule {
	createConfig: CreateGroConfig;
}
export interface CreateGroConfig {
	(options: CreateGroConfigOptions): Promise<GroConfig>;
}
export interface CreateGroConfigOptions {
	// env: NodeJS.ProcessEnv; // TODO?
	dev: boolean;
	log: Logger;
}

const CONFIG_FILE_NAME = 'gro.config.js';

let config: GroConfig | undefined;

export const loadConfig = async (forceRefresh = false): Promise<GroConfig> => {
	if (config && !forceRefresh) return config;

	const log = new SystemLogger([magenta('[config]')]);
	log.trace(`creating config for ${dev ? 'development' : 'production'}`);

	// Check if there's a config located at `${cwd}/src/gro.config.ts`.
	// If it doesn't exist, fall back to Gro's default config
	// located at `gro/src/project/gro.config.ts`.

	// TODO these are broken outside of dev mode right now -
	// we need to fix the server build to include the config file,
	// and we need to do several things, including making the local version work,
	// so Gro can be used as a dependency in other projects
	const localConfigFilePath = join(paths.build, CONFIG_FILE_NAME);
	const defaultConfigFilePath = join(paths.build, 'project', CONFIG_FILE_NAME);
	let configFilePath: string;
	if (existsSync(toSourceId(localConfigFilePath))) {
		if (!existsSync(localConfigFilePath)) {
			throw Error(
				`Found a local Gro config source file but not the built version. ` +
					`Do you need to run 'gro dev'?`,
			);
		}
		configFilePath = localConfigFilePath;
	} else {
		configFilePath = defaultConfigFilePath;
	}

	const createConfigModule = await importConfig(configFilePath);
	const {createConfig} = createConfigModule;

	config = await createConfig({log, dev});

	const result = validateConfig(config);
	if (!result.ok) {
		throw Error(`Invalid Gro config: ${result.reason}`);
	}

	return config;
};

const importConfig = async (configPath: string): Promise<CreateGroConfigModule> => {
	const mod = await import(configPath);
	if (typeof mod.createConfig !== 'function') {
		throw Error(
			`Invalid Gro config module. Expected a 'createConfig' function export from ${configPath}.`,
		);
	}
	return mod;
};

export const validateConfig = (config: GroConfig): Result<{}, {reason: string}> => {
	if (!config.buildConfigs.length) {
		return {ok: false, reason: `At least one build config must be provided.`};
	}
	return {ok: true};
};
