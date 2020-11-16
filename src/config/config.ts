import {
	paths,
	isGroId,
	isThisProjectGro,
	toBuildOutPath,
	CONFIG_BUILD_BASE_PATH,
} from '../paths.js';
import {
	BuildConfig,
	normalizeBuildConfigs,
	PartialBuildConfig,
	validateBuildConfigs,
} from './buildConfig.js';
import {Logger, SystemLogger} from '../utils/log.js';
import {magenta} from '../colors/terminal.js';
import {importTs} from '../fs/importTs.js';
import {pathExists} from '../fs/nodeFs.js';
import {compileSourceDirectory} from '../compile/compileSourceDirectory.js';
import internalConfig from '../gro.config.js';
import fallbackConfig from './gro.config.default.js';
import {DEFAULT_BUILD_CONFIG} from './defaultBuildConfig.js';

/*

The Gro config tells Gro how to build and manage a project.
Dependent projects can optionally define one at `src/gro.config.ts`.
If none is provided, the fallback is located here at `gro/src/config/gro.config.default.ts`.

The prevailing pattern in web development is to put config files like this in the root directory,
but Gro opts to put it in `src/`.
This choice keeps things simple and flexible because:

- a project's Gro config may share any amount of code and types bidirectionally
	with the project's source code
- the config itself is defined in TypeScript
- isolating all compilable source code in `src/` avoids a lot of tooling complexity

*/

const FALLBACK_CONFIG_NAME = `gro/src/config/gro.config.default.js`; // TODO try dynamic import again? was really slow for some reason, ~10ms
const INTERNAL_CONFIG_NAME = 'gro/src/gro.config.js'; // TODO try dynamic import again? was really slow for some reason, ~10ms

// See `./gro.config.ts` for documentation.
export interface GroConfig {
	readonly builds: BuildConfig[];
	readonly primaryNodeBuildConfig: BuildConfig;
	readonly primaryBrowserBuildConfig: BuildConfig | null;
}

export interface PartialGroConfig {
	readonly builds?: PartialBuildConfig[];
}

export interface GroConfigModule {
	readonly default: PartialGroConfig | GroConfigCreator;
}

export interface GroConfigCreator {
	(options: GroConfigCreatorOptions): PartialGroConfig | Promise<PartialGroConfig>;
}
export interface GroConfigCreatorOptions {
	// env: NodeJS.ProcessEnv; // TODO?
	readonly dev: boolean;
	readonly log: Logger;
}

let cachedExternalConfig: GroConfig | undefined;
let cachedInternalConfig: GroConfig | undefined;

/*

Loading the config is a fairly complex process.

First, we look for a config file local to the current working directory.
If none is found, we fall back to the default config provided by Gro.

Now that we've located the config file, we need to import it,
but we have a TypeScript file id, not importable JavaScript.

If the file id is the Gro default config, we can import it using Gro's own build configs.

If the file id instead is defined by the current project, importing is more complex.

The TS config file may already be compiled to JS in the project's Gro build cache on disk.
To attempt to import the file, we translate the TS id to the JS id in the build directory.

We can't just pick any build directory, however -
only the "primary" build should be used to run Node code,
so we need the build configs to locate the primary build.

Problem! The build configs are defined in the thing we're importing!
We're stuck in a circular dependency loop.
Luckily there's a way out, though it's somewhat imperfect.

The config may already be built in the cache directory.
If it exists, we import the config file and instantiate the config with it.
This config may be stale -
if it is, the Filer will detect this case and clear its cache on initialization.
(TODO but won't the config be stale? hmm. TODO!!)

If the cached config build file doesn't exist, we're in an unbuilt project.
In this case, we perform a minimal compilation of the config file and its dependency tree to
a temporary directory, then import the JS config file, and then delete the temporary directory.

The temporary compilation options may not match the user defined primary build's options,
but it appears like that should probably not cause bugs.
The original design had users statically define a project's builds in `package.json`
to avoid any potential issues,
but we removed this and opted to put all Gro-related configuration in a single place,
and we'll deal with any bugs that come up.

*/

export const loadConfigFor = (id: string): Promise<GroConfig> =>
	isGroId(id) ? loadInternalConfig() : loadConfig();

export const loadConfig = async (
	buildConfig: BuildConfig = DEFAULT_BUILD_CONFIG,
): Promise<GroConfig> => {
	if (isThisProjectGro) return loadInternalConfig();
	if (cachedExternalConfig !== undefined) return cachedExternalConfig;

	const dev = process.env.NODE_ENV !== 'production'; // TODO what's the right way to do this?
	const log = new SystemLogger([magenta('[config]')]);
	log.trace(`loading Gro config for ${dev ? 'development' : 'production'}`);
	const options: GroConfigCreatorOptions = {log, dev};

	const {configSourceId} = paths;

	let configModule: GroConfigModule;
	let modulePath: string;
	let bootstrapping = false;
	if (await pathExists(configSourceId)) {
		// The project has a `gro.config.ts`, so import it.
		// If it's not already built, we need to bootstrap the config and use it to compile everything.
		modulePath = configSourceId;
		const externalConfigBuildId = toBuildOutPath(dev, buildConfig.name, CONFIG_BUILD_BASE_PATH);
		if (await pathExists(externalConfigBuildId)) {
			configModule = await import(externalConfigBuildId);
		} else {
			// We need to bootstrap the config because it's not yet built.
			// This is the lightest possible build process
			// to compile the config from TypeScript to importable JavaScript.
			// Importantly, the build config is typically the default, because it hasn't yet been loaded,
			// so there could be subtle differences between the actual and bootstrapped configs.
			bootstrapping = true;
			configModule = await importTs(configSourceId, buildConfig);
		}
	} else {
		// The project does not have a `gro.config.ts`, so use Gro's fallback default.
		modulePath = FALLBACK_CONFIG_NAME;
		configModule = {default: fallbackConfig};
	}

	const validated = validateConfigModule(configModule);
	if (!validated.ok) {
		throw Error(`Invalid Gro config module at '${modulePath}': ${validated.reason}`);
	}
	const config = await toConfig(configModule.default, modulePath, options);
	if (bootstrapping) {
		// Now that we have the bootstrapped config, use it to compile the project,
		// and then call `loadConfig` again with the primary build config
		// to load the proper config from disk, rather than the bootstrapped version.
		// The bootstrapped version may have subtle differences
		// because it does not use the project's expected compiler options.
		// This is slower, but it should make bootstrapping bugs much more rare.
		await compileSourceDirectory(config, dev, log);
		return loadConfig(config.primaryNodeBuildConfig);
	} else {
		cachedExternalConfig = config;
		return cachedExternalConfig;
	}
};

export const loadInternalConfig = async (): Promise<GroConfig> => {
	if (cachedInternalConfig !== undefined) return cachedInternalConfig;

	const dev = process.env.NODE_ENV !== 'production'; // TODO what's the right way to do this?
	const log = new SystemLogger([magenta('[config]')]);
	log.trace(`loading internal Gro config for ${dev ? 'development' : 'production'}`);
	const options: GroConfigCreatorOptions = {log, dev};

	cachedInternalConfig = await toConfig(internalConfig, INTERNAL_CONFIG_NAME, options);

	return cachedInternalConfig;
};

export const toConfig = async (
	configOrCreator: PartialGroConfig | GroConfigCreator,
	path: string,
	options: GroConfigCreatorOptions,
): Promise<GroConfig> => {
	const configPartial =
		typeof configOrCreator === 'function' ? await configOrCreator(options) : configOrCreator;

	const config = normalizeConfig(configPartial);

	const validateResult = validateConfig(config);
	if (!validateResult.ok) {
		throw Error(`Invalid Gro config at '${path}': ${validateResult.reason}`);
	}

	return config;
};

const validateConfigModule = (configModule: any): Result<{}, {reason: string}> => {
	if (!(typeof configModule.default === 'function' || typeof configModule.default === 'object')) {
		throw Error(`Invalid Gro config module. Expected a default export.`);
	}
	return {ok: true};
};

const validateConfig = (config: GroConfig): Result<{}, {reason: string}> => {
	const buildConfigsResult = validateBuildConfigs(config.builds);
	if (!buildConfigsResult.ok) return buildConfigsResult;
	return {ok: true};
};

const normalizeConfig = (config: PartialGroConfig): GroConfig => {
	const buildConfigs = normalizeBuildConfigs(config.builds);
	const primaryNodeBuildConfig = buildConfigs.find((b) => b.primary && b.platform === 'node')!;
	const primaryBrowserBuildConfig =
		buildConfigs.find((b) => b.primary && b.platform === 'browser') || null;
	return {
		...config,
		builds: buildConfigs,
		primaryNodeBuildConfig,
		primaryBrowserBuildConfig,
	};
};
