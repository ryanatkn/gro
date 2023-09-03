import {type LogLevel, Logger, SystemLogger, printLogLabel} from '@feltjs/util/log.js';
import {omitUndefined} from '@feltjs/util/object.js';
import type {Result} from '@feltjs/util/result.js';
import type {Assignable} from '@feltjs/util/types.js';
import {toArray} from '@feltjs/util/array.js';

import {paths, toBuildOutPath, CONFIG_BUILD_BASE_PATH} from '../path/paths.js';
import {
	normalizeBuildConfigs,
	validateBuildConfigs,
	type BuildConfig,
	type BuildConfigPartial,
} from '../build/buildConfig.js';
import type {ToConfigAdapters} from '../adapt/adapt.js';
import {DEFAULT_ECMA_SCRIPT_TARGET, SYSTEM_BUILD_NAME} from '../build/buildConfigDefaults.js';
import type {EcmaScriptTarget} from '../build/helpers.js';
import type {Filesystem} from '../fs/filesystem.js';
import createDefaultConfig from './gro.config.default.js';
import type {ToConfigPlugins} from '../plugin/plugin.js';

/*

See `../docs/config.md` for documentation.

The Gro config tells Gro how to build and manage a project.
Dependent projects can optionally define one at `src/gro.config.ts`.
If none is provided, the fallback is located at `gro/src/lib/config/gro.config.default.ts`.

The prevailing pattern in web development is to put config files like this in the root directory,
but Gro opts to put it in `src/`.
This choice keeps things simple and flexible because:

- a project's Gro config may share any amount of code and types bidirectionally
	with the project's source code
- the config itself is defined in TypeScript
- isolating all buildable source code in `src/` avoids a lot of tooling complexity

*/

export interface GroConfig {
	readonly builds: BuildConfig[];
	readonly plugin: ToConfigPlugins;
	readonly adapt: ToConfigAdapters;
	readonly target: EcmaScriptTarget;
	readonly sourcemap: boolean;
	readonly logLevel: LogLevel;
}

export interface GroConfigPartial {
	readonly builds?: Array<BuildConfigPartial | null> | BuildConfigPartial | null; // allow `null` for convenience
	readonly plugin?: ToConfigPlugins;
	readonly adapt?: ToConfigAdapters;
	readonly target?: EcmaScriptTarget;
	readonly sourcemap?: boolean;
	readonly logLevel?: LogLevel;
}

export interface GroConfigModule {
	readonly default: GroConfigPartial | GroConfigCreator;
}

export interface GroConfigCreator {
	(options: GroConfigCreatorOptions): GroConfigPartial | Promise<GroConfigPartial>;
}
export interface GroConfigCreatorOptions {
	// env: NodeJS.ProcessEnv; // TODO?
	readonly fs: Filesystem;
	readonly log: Logger;
	readonly config: GroConfig; // default config is available for user config code
}

/*

Loading the config is a fairly complex process.

First, we look for a config source file relative to the current working directory.
If none is found, we fall back to the default config provided by Gro.

Now that we've located the config file, we need to import it,
but we have a TypeScript file id, not importable JavaScript.

First we translate the TS id to the JS id in the build directory.
Then we check if the JS config file is built.

If it exists, we import the config file and use it to create and return the config.

If it doesn't exist, we're in an unbuilt project.
In this case, we bootstrap the config by performing a minimal build
of the config file and its dependency tree to a temporary directory,
then import the temporary JS config file, then delete the temporary directory,
and finally create and return the config.

Caveats

- The built config or its built dependencies might be stale! For now `gro dev` is the fix.
- The bootstrap process creates the config outside of the normal build process.
	Things can go wrong if the config or its dependencies need special build behavior
	that's not handled by the default TS->JS build.
	This was previously solved by using the bootstrapped config to compile the project,
	and then the compiled config was imported and created and returned,
	but this duplicates building in the normal case where `invokeTask` loads the config,
	and it fixes only a subset of issues caused by the config needing special build behavior.
	Instead, we simply return the bootstrapped config and expect it to be correct.

*/

let cachedConfig: Promise<GroConfig> | undefined;

export const loadConfig = async (fs: Filesystem): Promise<GroConfig> => {
	if (cachedConfig) return cachedConfig;
	return (cachedConfig = _loadConfig(fs));
};

const _loadConfig = async (fs: Filesystem): Promise<GroConfig> => {
	const log = new SystemLogger(printLogLabel('config'));

	const options: GroConfigCreatorOptions = {fs, log, config: null as any};
	const defaultConfig = await toConfig(createDefaultConfig, options, '');
	console.log(`defaultConfig`, defaultConfig, defaultConfig.builds[0]);
	(options as Assignable<GroConfigCreatorOptions, 'config'>).config = defaultConfig;

	const {configSourceId} = paths;
	let config: GroConfig;
	console.log(`_loadConfig configSourceId`, configSourceId);
	if (await fs.exists(configSourceId)) {
		console.log('_loadConfig EXISTS');
		// TODO BLOCK this is a hack, may be acceptable for now, we were previously erroring if `configBuildId` isn't found
		// The project has a `gro.config.ts`, so import it.
		// If it's not already built, we need to bootstrap the config and use it to compile everything.
		const configBuildId = toBuildOutPath(true, SYSTEM_BUILD_NAME, CONFIG_BUILD_BASE_PATH);
		if (await fs.exists(configBuildId)) {
			console.log('_loadConfig EXISTS AND FOUND');
			const configModule = await import(configBuildId);
			validateConfigModule(configModule, configSourceId);
			config = await toConfig(configModule.default, options, configSourceId, defaultConfig);
		} else {
			console.log('_loadConfig EXISTS BUT NOT FOUND');
			config = defaultConfig;
		}
	} else {
		console.log('_loadConfig DOESNT EXIST');
		config = defaultConfig;
	}
	console.log(`config`, config, config.builds[0]);
	return config;
};

export const toConfig = async (
	configOrCreator: GroConfigPartial | GroConfigCreator,
	options: GroConfigCreatorOptions,
	path: string,
	baseConfig?: GroConfig,
): Promise<GroConfig> => {
	const configPartial =
		typeof configOrCreator === 'function' ? await configOrCreator(options) : configOrCreator;

	const extendedConfig = baseConfig ? {...baseConfig, ...configPartial} : configPartial;

	const config = normalizeConfig(extendedConfig);

	const validateResult = await validateConfig(options.fs, config);
	if (!validateResult.ok) {
		throw Error(`Invalid Gro config at '${path}': ${validateResult.reason}`);
	}

	return config;
};

const validateConfigModule: (
	configModule: any,
	configSourceId: string,
) => asserts configModule is GroConfigModule = (configModule, configSourceId) => {
	const config = configModule.default;
	if (!config) {
		throw Error(`Invalid Gro config module at ${configSourceId}: expected a default export`);
	} else if (!(typeof config === 'function' || typeof config === 'object')) {
		throw Error(
			`Invalid Gro config module at ${configSourceId}: the default export must be a function or object`,
		);
	}
};

const validateConfig = async (
	fs: Filesystem,
	config: GroConfig,
): Promise<Result<object, {reason: string}>> => {
	const buildConfigsResult = await validateBuildConfigs(fs, config.builds);
	if (!buildConfigsResult.ok) return buildConfigsResult;
	return {ok: true};
};

const normalizeConfig = (config: GroConfigPartial): GroConfig => {
	const buildConfigs = normalizeBuildConfigs(toArray(config.builds || null));
	return {
		sourcemap: true,
		logLevel: Logger.level,
		plugin: () => null,
		adapt: () => null,
		...omitUndefined(config),
		builds: buildConfigs,
		target: config.target || DEFAULT_ECMA_SCRIPT_TARGET,
	};
};
