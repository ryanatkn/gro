import {
	basePathToSourceId,
	isGroId,
	isThisProjectGro,
	JS_EXTENSION,
	toBuildOutDir,
} from '../paths.js';
import {BuildConfig, findPrimaryBuildConfig} from './buildConfig.js';
import {Logger, SystemLogger} from '../utils/log.js';
import {magenta} from '../colors/terminal.js';
import {importTs} from '../fs/importTs.js';
import {pathExists} from '../fs/nodeFs.js';
import {compileSourceDirectory} from '../compile/compileSourceDirectory.js';
import {replaceExtension} from '../utils/path.js';

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

const EXTERNAL_CONFIG_SOURCE_BASE_PATH = 'gro.config.ts';
const FALLBACK_CONFIG_IMPORT_PATH = `./gro.config.default.js`;
const INTERNAL_CONFIG_IMPORT_PATH = '../gro.config.js';
const BOOTSTRAP_BUILD_CONFIG: BuildConfig = {name: 'node', platform: 'node'};

// See `./gro.config.ts` for documentation.
export interface GroConfig {
	builds: BuildConfig[];
}

export interface GroConfigModule {
	default: GroConfig | GroConfigCreator;
}

export interface GroConfigCreator {
	(options: GroConfigCreatorOptions): Promise<GroConfig>;
}
export interface GroConfigCreatorOptions {
	// env: NodeJS.ProcessEnv; // TODO?
	dev: boolean;
	log: Logger;
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

When Gro runs its dev processes, it caches build configs at `.gro/cachedBuildOptions.json`,
so we try to load that file if it exists.
If we find the file, we use its build configs
to translate the original TS id to the primary build's JS version, and then import it.

If the cached build options file doesn't exist, we're in an unbuilt project.
In this case, we perform a minimal compilation of the config file and its dependency tree to
a temporary directory, then import the JS config file, and then delete the temporary directory.

The temporary compilation options may not match the user defined primary build's options,
but it appears like that should probably not cause bugs.
The original design had users statically define a project's builds in `package.json`
to avoid any potential issues,
but we removed this and opted to put all Gro-related configuration in a single place,
and we'll deal with any bugs that come up.

*/

export const loadConfigAt = (id: string): Promise<GroConfig> =>
	isGroId(id) ? loadInternalConfig() : loadConfig();

export const loadConfig = async (
	buildConfig: BuildConfig = BOOTSTRAP_BUILD_CONFIG,
): Promise<GroConfig> => {
	if (isThisProjectGro) return loadInternalConfig();
	if (cachedExternalConfig !== undefined) return cachedExternalConfig;

	const dev = process.env.NODE_ENV !== 'production'; // TODO what's the right way to do this?
	const log = new SystemLogger([magenta('[config]')]);
	log.trace(`loading Gro config for ${dev ? 'development' : 'production'}`);
	const options: GroConfigCreatorOptions = {log, dev};

	const externalConfigSourceId = basePathToSourceId(EXTERNAL_CONFIG_SOURCE_BASE_PATH);

	let configModule: GroConfigModule;
	let modulePath: string;
	if (await pathExists(externalConfigSourceId)) {
		// The project has a `gro.config.ts`, so import it.
		// If it's not already built, we need to bootstrap the config and use it to compile everything.
		modulePath = externalConfigSourceId;
		const externalConfigBuildId = toBuildOutDir(
			dev,
			buildConfig.name,
			replaceExtension(EXTERNAL_CONFIG_SOURCE_BASE_PATH, JS_EXTENSION),
		);
		if (await pathExists(externalConfigBuildId)) {
			configModule = await import(externalConfigBuildId);
		} else {
			// We need to bootstrap the config.
			configModule = await importTs(externalConfigSourceId, buildConfig);
			const config = await toConfig(configModule, modulePath, options);
			// Now that we have the bootstrapped config, use it to compile the project,
			// and then call `loadConfig` again with the primary build config
			// to load the proper config from disk, rather than the bootstrapped version.
			// The bootstrapped version may have subtle differences
			// because it does not use the project's expected compiler options.
			// This is slower, but it should make bootstrapping bugs much more rare.
			await compileSourceDirectory(config, dev, log);
			return loadConfig(findPrimaryBuildConfig(config));
		}
	} else {
		// The project does not have a `gro.config.ts`, so use Gro's fallback default.
		configModule = await import(FALLBACK_CONFIG_IMPORT_PATH);
		modulePath = FALLBACK_CONFIG_IMPORT_PATH;
	}

	cachedExternalConfig = await toConfig(configModule, modulePath, options);
	return cachedExternalConfig;
};

export const loadInternalConfig = async (): Promise<GroConfig> => {
	if (cachedInternalConfig !== undefined) return cachedInternalConfig;

	const dev = process.env.NODE_ENV !== 'production'; // TODO what's the right way to do this?
	const log = new SystemLogger([magenta('[config]')]);
	log.trace(`loading Gro internal config for ${dev ? 'development' : 'production'}`);
	const options: GroConfigCreatorOptions = {log, dev};

	const configModule: GroConfigModule = await import(INTERNAL_CONFIG_IMPORT_PATH);

	cachedInternalConfig = await toConfig(configModule, INTERNAL_CONFIG_IMPORT_PATH, options);

	return cachedInternalConfig;
};

export const toConfig = async (
	mod: GroConfigModule,
	path: string,
	options: GroConfigCreatorOptions,
): Promise<GroConfig> => {
	const validated = validateConfigModule(mod);
	if (!validated.ok) {
		throw Error(`Invalid Gro config module at '${path}': ${validated.reason}`);
	}

	const configOrCreator = mod.default;
	const config =
		typeof configOrCreator === 'function' ? await configOrCreator(options) : configOrCreator;

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
	if (!config.builds.length) {
		return {ok: false, reason: `At least one build config must be provided.`};
	}
	return {ok: true};
};
