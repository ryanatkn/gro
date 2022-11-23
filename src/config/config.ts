import {
	type LogLevel,
	SystemLogger,
	configureLogLevel,
	printLogLabel,
	DEFAULT_LOG_LEVEL,
} from '@feltcoop/util/log.js';
import {omitUndefined} from '@feltcoop/util/object.js';
import type {Assignable, Result} from '@feltcoop/util';
import {toArray} from '@feltcoop/util/array.js';
import type {Logger} from '@feltcoop/util/log.js';

import {paths, toBuildOutPath, CONFIG_BUILD_PATH, DIST_DIRNAME} from '../paths.js';
import {
	normalizeBuildConfigs,
	validateBuildConfigs,
	type BuildConfig,
	type BuildConfigPartial,
} from '../build/buildConfig.js';
import type {ToConfigAdapters} from '../adapt/adapt.js';
import {
	DEFAULT_ECMA_SCRIPT_TARGET,
	NODE_LIBRARY_BUILD_NAME,
	CONFIG_BUILD_CONFIG,
} from '../build/buildConfigDefaults.js';
import type {EcmaScriptTarget} from '../build/typescriptUtils.js';
import type {Filesystem} from '../fs/filesystem.js';
import createDefaultConfig from './gro.config.default.js';
import type {ToConfigPlugins} from '../plugin/plugin.js';

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
	readonly plugin: ToConfigPlugins;
	readonly adapt: ToConfigAdapters;
	readonly target: EcmaScriptTarget;
	readonly sourcemap: boolean;
	readonly typemap: boolean;
	readonly logLevel: LogLevel;
	readonly primaryBrowserBuildConfig: BuildConfig | null; // TODO improve this, too rigid
}

export interface GroConfigPartial {
	readonly builds?: Array<BuildConfigPartial | null> | BuildConfigPartial | null; // allow `null` for convenience
	readonly publish?: string | null; // dir to publish: defaults to 'dist/library', or null if it doesn't exist -- TODO support multiple
	readonly plugin?: ToConfigPlugins;
	readonly adapt?: ToConfigAdapters;
	readonly target?: EcmaScriptTarget;
	readonly sourcemap?: boolean;
	readonly typemap?: boolean;
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
	readonly dev: boolean;
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

let cachedDevConfig: Promise<GroConfig> | undefined;
let cachedProdConfig: Promise<GroConfig> | undefined;

export const loadConfig = async (
	fs: Filesystem,
	dev: boolean,
	applyConfigToSystem = true,
): Promise<GroConfig> => {
	if (dev) {
		if (cachedDevConfig) return cachedDevConfig;
		return (cachedDevConfig = _loadConfig(fs, dev, applyConfigToSystem));
	}
	if (cachedProdConfig) return cachedProdConfig;
	return (cachedProdConfig = _loadConfig(fs, dev, applyConfigToSystem));
};

const _loadConfig = async (
	fs: Filesystem,
	dev: boolean,
	applyConfigToSystem = true,
): Promise<GroConfig> => {
	const log = new SystemLogger(printLogLabel('config'));

	const options: GroConfigCreatorOptions = {fs, log, dev, config: null as any};
	const defaultConfig = await toConfig(createDefaultConfig, options, '');
	(options as Assignable<GroConfigCreatorOptions, 'config'>).config = defaultConfig;

	const {configSourceId} = paths;
	let config: GroConfig;
	if (await fs.exists(configSourceId)) {
		const {buildSource} = await import('../build/buildSource.js');
		await buildSource(fs, toBootstrapConfig(), dev, log);

		// The project has a `gro.config.ts`, so import it.
		// If it's not already built, we need to bootstrap the config and use it to compile everything.
		const configBuildId = toBuildOutPath(dev, CONFIG_BUILD_CONFIG.name, CONFIG_BUILD_PATH);
		if (!(await fs.exists(configBuildId))) {
			throw Error(`Cannot find config build id: ${configBuildId} from ${configSourceId}`);
		}
		const configModule = await import(configBuildId);
		validateConfigModule(configModule, configSourceId);
		config = await toConfig(configModule.default, options, configSourceId, defaultConfig);
	} else {
		config = defaultConfig;
	}
	if (applyConfigToSystem) applyConfig(config);
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

	const config = normalizeConfig(extendedConfig, options.dev);

	const validateResult = await validateConfig(options.fs, config, options.dev);
	if (!validateResult.ok) {
		throw Error(`Invalid Gro config at '${path}': ${validateResult.reason}`);
	}

	return config;
};

const toBootstrapConfig = (): GroConfig => {
	return {
		sourcemap: false,
		typemap: false,
		types: false,
		logLevel: DEFAULT_LOG_LEVEL,
		plugin: () => null,
		adapt: () => null,
		builds: [CONFIG_BUILD_CONFIG],
		publish: null,
		target: DEFAULT_ECMA_SCRIPT_TARGET,
		primaryBrowserBuildConfig: null,
	};
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
	dev: boolean,
): Promise<Result<object, {reason: string}>> => {
	const buildConfigsResult = await validateBuildConfigs(fs, config.builds, dev);
	if (!buildConfigsResult.ok) return buildConfigsResult;
	return {ok: true};
};

const normalizeConfig = (config: GroConfigPartial, dev: boolean): GroConfig => {
	const buildConfigs = normalizeBuildConfigs(toArray(config.builds || null), dev);
	return {
		sourcemap: dev,
		typemap: !dev,
		types: false,
		logLevel: DEFAULT_LOG_LEVEL,
		plugin: () => null,
		adapt: () => null,
		...omitUndefined(config),
		builds: buildConfigs,
		publish:
			config.publish || config.publish === null
				? config.publish
				: toDefaultPublishDirs(buildConfigs),
		target: config.target || DEFAULT_ECMA_SCRIPT_TARGET,
		// TODO instead of `primary` build configs, we want to be able to mount any number of them at once,
		// so this is a temp hack that just chooses the first browser build
		primaryBrowserBuildConfig: buildConfigs.find((b) => b.platform === 'browser') || null,
	};
};

const toDefaultPublishDirs = (buildConfigs: BuildConfig[]): string | null => {
	const buildConfigToPublish = buildConfigs.find((b) => b.name === NODE_LIBRARY_BUILD_NAME);
	return buildConfigToPublish ? `${DIST_DIRNAME}/${buildConfigToPublish.name}` : null;
};
