import {paths, groPaths, toBuildOutPath, CONFIG_BUILD_BASE_PATH} from '../paths.js';
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
import {DEFAULT_BUILD_CONFIG} from './defaultBuildConfig.js';

/*

See `../docs/config.md` for documentation.

The Gro config tells Gro how to build and manage a project.
Dependent projects can optionally define one at `src/gro.config.ts`.
If none is provided, the fallback is located at `gro/src/config/gro.config.default.ts`.

The prevailing pattern in web development is to put config files like this in the root directory,
but Gro opts to put it in `src/`.
This choice keeps things simple and flexible because:

- a project's Gro config may share any amount of code and types bidirectionally
	with the project's source code
- the config itself is defined in TypeScript
- isolating all compilable source code in `src/` avoids a lot of tooling complexity

*/

const FALLBACK_CONFIG_NAME = 'gro/src/config/gro.config.default.ts';
const FALLBACK_CONFIG_BUILD_BASE_PATH = 'config/gro.config.default.js';

export interface GroConfig {
	readonly builds: BuildConfig[];
	readonly primaryNodeBuildConfig: BuildConfig;
	readonly primaryBrowserBuildConfig: BuildConfig | null;
}

export interface PartialGroConfig {
	readonly builds: PartialBuildConfig[];
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

let cachedConfig: GroConfig | undefined;

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
In this case, we bootstrap the config by performing a minimal compilation
of the config file and its dependency tree to a temporary directory,
then import the temporary JS config file, then delete the temporary directory,
and finally create and return the config.

Caveats

- The built config or its built depdendencies might be stale! For now `gro dev` is the fix.
- The bootstrap process creates the config outside of the normal build process.
	Things can go wrong if the config or its dependencies need special compilation behavior
	that's not handled by the default TS->JS compilation.
	This was previously solved by using the bootstrapped config to compile the project,
	and then the compiled config was imported and created and returned,
	but this duplicates compilation in the normal case where `invokeTask` loads the config,
	and it fixes only a subset of issues caused by the config needing special compilation.
	Instead, we simply return the bootstrapped config and expect it to be correct.

*/

export const loadGroConfig = async (): Promise<GroConfig> => {
	if (cachedConfig !== undefined) return cachedConfig;

	const dev = process.env.NODE_ENV !== 'production'; // TODO should this be a parameter or accessed via a helper?
	const log = new SystemLogger([magenta('[config]')]);
	const options: GroConfigCreatorOptions = {log, dev};

	const {configSourceId} = paths;

	let configModule: GroConfigModule;
	let modulePath: string;
	if (await pathExists(configSourceId)) {
		// The project has a `gro.config.ts`, so import it.
		// If it's not already built, we need to bootstrap the config and use it to compile everything.
		modulePath = configSourceId;
		const configBuildId = toBuildOutPath(dev, DEFAULT_BUILD_CONFIG.name, CONFIG_BUILD_BASE_PATH);
		if (await pathExists(configBuildId)) {
			configModule = await import(configBuildId);
		} else {
			// We need to bootstrap the config because it's not yet built.
			// This is the lightest possible build process
			// to compile the config from TypeScript to importable JavaScript.
			// Importantly, the build config is typically the default, because it hasn't yet been loaded,
			// so there could be subtle differences between the actual and bootstrapped configs.
			configModule = await importTs(configSourceId, DEFAULT_BUILD_CONFIG);
		}
	} else {
		// The project does not have a `gro.config.ts`, so use Gro's fallback default.
		modulePath = FALLBACK_CONFIG_NAME;
		const fallbackConfigBuildId = toBuildOutPath(
			dev,
			DEFAULT_BUILD_CONFIG.name,
			FALLBACK_CONFIG_BUILD_BASE_PATH,
			groPaths.build,
		);
		configModule = await import(fallbackConfigBuildId);
	}

	const validated = validateConfigModule(configModule);
	if (!validated.ok) {
		throw Error(`Invalid Gro config module at '${modulePath}': ${validated.reason}`);
	}
	cachedConfig = await toConfig(configModule.default, options, modulePath);
	return cachedConfig;
};

export const toConfig = async (
	configOrCreator: PartialGroConfig | GroConfigCreator,
	options: GroConfigCreatorOptions,
	path: string,
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
