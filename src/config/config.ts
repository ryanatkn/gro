import {
	LogLevel,
	SystemLogger,
	configureLogLevel,
	printLogLabel,
	DEFAULT_LOG_LEVEL,
} from '@feltcoop/felt/utils/log.js';
import type {Logger} from '@feltcoop/felt/utils/log.js';
import {omitUndefined} from '@feltcoop/felt/utils/object.js';
import type {Assignable, Result} from '@feltcoop/felt/utils/types.js';
import {toArray} from '@feltcoop/felt/utils/array.js';

import {paths, toBuildOutPath, CONFIG_BUILD_PATH, DIST_DIRNAME} from '../paths.js';
import {
	isSystemBuildConfig,
	isConfigBuildConfig,
	normalizeBuildConfigs,
	validateBuildConfigs,
} from '../build/buildConfig.js';
import type {AdaptBuilds} from '../adapt/adapter.js';
import type {BuildConfig, BuildConfigPartial} from '../build/buildConfig.js';
import {
	DEFAULT_ECMA_SCRIPT_TARGET,
	NODE_LIBRARY_BUILD_NAME,
	CONFIG_BUILD_CONFIG,
} from '../build/defaultBuildConfig.js';
import type {EcmaScriptTarget} from '../build/tsBuildHelpers.js';
import type {ServedDirPartial} from '../build/servedDir.js';
import {DEFAULT_SERVER_HOST, DEFAULT_SERVER_PORT} from '../server/server.js';
import type {Filesystem} from '../fs/filesystem.js';
import {config as createDefaultConfig} from './gro.config.default.js';

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
- isolating all buildable source code in `src/` avoids a lot of tooling complexity

*/

export interface GroConfig {
	readonly builds: BuildConfig[];
	readonly publish: string | null;
	readonly adapt: AdaptBuilds;
	readonly target: EcmaScriptTarget;
	readonly sourcemap: boolean;
	readonly host: string;
	readonly port: number;
	readonly logLevel: LogLevel;
	readonly serve?: ServedDirPartial[];
	readonly configBuildConfig: BuildConfig;
	readonly systemBuildConfig: BuildConfig;
	readonly primaryBrowserBuildConfig: BuildConfig | null; // TODO improve this, too rigid
}

export interface GroConfigPartial {
	readonly builds?: (BuildConfigPartial | null)[] | BuildConfigPartial | null; // allow `null` for convenience
	readonly publish?: string | null; // dir to publish: defaults to 'dist/library', or null if it doesn't exist -- TODO support multiple
	readonly adapt?: AdaptBuilds;
	readonly target?: EcmaScriptTarget;
	readonly sourcemap?: boolean;
	readonly host?: string;
	readonly port?: number;
	readonly logLevel?: LogLevel;
	readonly serve?: ServedDirPartial[];
}

export interface GroConfigModule {
	readonly config: GroConfigPartial | GroConfigCreator;
}

export interface GroConfigCreator {
	(options: GroConfigCreatorOptions): GroConfigPartial | Promise<GroConfigPartial>;
}
export interface GroConfigCreatorOptions {
	// env: NodeJS.ProcessEnv; // TODO?
	readonly fs: Filesystem;
	readonly dev: boolean;
	readonly log: Logger;
	readonly config: GroConfig; // default config is available for user config code
}

let cachedDevConfig: GroConfig | undefined;
let cachedProdConfig: GroConfig | undefined;

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

- The built config or its built depdendencies might be stale! For now `gro dev` is the fix.
- The bootstrap process creates the config outside of the normal build process.
	Things can go wrong if the config or its dependencies need special build behavior
	that's not handled by the default TS->JS build.
	This was previously solved by using the bootstrapped config to compile the project,
	and then the compiled config was imported and created and returned,
	but this duplicates building in the normal case where `invokeTask` loads the config,
	and it fixes only a subset of issues caused by the config needing special build behavior.
	Instead, we simply return the bootstrapped config and expect it to be correct.

*/

const applyConfig = (config: GroConfig) => {
	// other things?
	configureLogLevel(config.logLevel);
};

export const loadConfig = async (
	fs: Filesystem,
	dev: boolean,
	applyConfigToSystem = true,
): Promise<GroConfig> => {
	const cachedConfig = dev ? cachedDevConfig : cachedProdConfig;
	if (cachedConfig) {
		if (applyConfigToSystem) applyConfig(cachedConfig);
		return cachedConfig;
	}

	const log = new SystemLogger(printLogLabel('config'));

	const {buildSourceDirectory} = await import('../build/buildSourceDirectory.js');
	const bootstrap_config = await toConfig(
		{builds: [CONFIG_BUILD_CONFIG], sourcemap: dev},
		options,
		'gro/config',
	);
	await buildSourceDirectory(fs, bootstrap_config, dev, log);

	const {configSourceId} = paths;

	let config: GroConfig;
	if (await fs.exists(configSourceId)) {
		// The project has a `gro.config.ts`, so import it.
		// If it's not already built, we need to bootstrap the config and use it to compile everything.
		const configBuildId = toBuildOutPath(dev, CONFIG_BUILD_CONFIG.name, CONFIG_BUILD_PATH);
		if (!(await fs.exists(configBuildId))) {
			const {buildSourceDirectory} = await import('../build/buildSourceDirectory.js');
			await buildSourceDirectory(
				fs,
				// TOOD should be a `BOOTSTRAP_CONFIG` or something
				// TODO feels hacky, the `sourcemap` in particular
				await toConfig({builds: [CONFIG_BUILD_CONFIG], sourcemap: dev}, options, configSourceId),
				dev,
				log,
			);
		}
		const configModule = await import(configBuildId);
		const validated = validateConfigModule(configModule);
		if (!validated.ok) {
			throw Error(`Invalid Gro config module at '${configSourceId}': ${validated.reason}`);
		}
		config = await toConfig(configModule.config, options, configSourceId);
	} else {
		const options: GroConfigCreatorOptions = {fs, log, dev, config: null as any};
		const defaultConfig = await toConfig(createDefaultConfig, options, '');
		(options as Assignable<GroConfigCreatorOptions, 'config'>).config = defaultConfig;

		config = defaultConfig;
	}
	if (dev) {
		cachedDevConfig = config;
	} else {
		cachedProdConfig = config;
	}
	if (applyConfigToSystem) applyConfig(config);
	return config;
};

export const toConfig = async (
	configOrCreator: GroConfigPartial | GroConfigCreator,
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
	if (!(typeof configModule.config === 'function' || typeof configModule.config === 'object')) {
		throw Error(`Invalid Gro config module. Expected a 'config' export.`);
	}
	return {ok: true};
};

const validateConfig = (config: GroConfig): Result<{}, {reason: string}> => {
	const buildConfigsResult = validateBuildConfigs(config.builds);
	if (!buildConfigsResult.ok) return buildConfigsResult;
	return {ok: true};
};

const normalizeConfig = (config: GroConfigPartial): GroConfig => {
	const buildConfigs = normalizeBuildConfigs(toArray(config.builds || null));
	return {
		sourcemap: process.env.NODE_ENV !== 'production', // TODO maybe default to tsconfig?
		host: DEFAULT_SERVER_HOST,
		port: DEFAULT_SERVER_PORT,
		logLevel: DEFAULT_LOG_LEVEL,
		adapt: () => null,
		...omitUndefined(config),
		builds: buildConfigs,
		publish:
			config.publish || config.publish === null
				? config.publish
				: toDefaultPublishDirs(buildConfigs),
		target: config.target || DEFAULT_ECMA_SCRIPT_TARGET,
		configBuildConfig: buildConfigs.find((b) => isConfigBuildConfig(b))!,
		systemBuildConfig: buildConfigs.find((b) => isSystemBuildConfig(b))!,
		// TODO instead of `primary` build configs, we want to be able to mount any number of them at once,
		// so this is a temp hack that just chooses the first browser build
		primaryBrowserBuildConfig: buildConfigs.find((b) => b.platform === 'browser') || null,
	};
};

const toDefaultPublishDirs = (buildConfigs: BuildConfig[]): string | null => {
	const buildConfigToPublish = buildConfigs.find((b) => b.name === NODE_LIBRARY_BUILD_NAME);
	return buildConfigToPublish ? `${DIST_DIRNAME}/${buildConfigToPublish.name}` : null;
};
