import {
	Log_Level,
	SystemLogger,
	configureLog_Level,
	printLogLabel,
	DEFAULT_LOG_LEVEL,
} from '@feltcoop/felt/utils/log.js';
import type {Logger} from '@feltcoop/felt/utils/log.js';
import {omitUndefined} from '@feltcoop/felt/utils/object.js';
import type {Assignable, Result} from '@feltcoop/felt/utils/types.js';
import {toArray} from '@feltcoop/felt/utils/array.js';

import {paths, to_build_out_path, CONFIG_BUILD_PATH, DIST_DIRNAME} from '../paths.js';
import {
	is_system_build_config,
	isConfigBuild_Config,
	normalize_build_configs,
	validate_build_configs,
} from '../build/build_config.js';
import type {AdaptBuilds} from '../adapt/adapter.js';
import type {Build_Config, Build_Config_Partial} from '../build/build_config.js';
import {
	DEFAULT_ECMA_SCRIPT_TARGET,
	NODE_LIBRARY_BUILD_NAME,
	CONFIG_BUILD_CONFIG,
} from '../build/default_build_config.js';
import type {EcmaScriptTarget} from '../build/tsBuildHelpers.js';
import type {Served_Dir_Partial} from '../build/served_dir.js';
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

export interface Gro_Config {
	readonly builds: Build_Config[];
	readonly publish: string | null;
	readonly adapt: AdaptBuilds;
	readonly target: EcmaScriptTarget;
	readonly sourcemap: boolean;
	readonly host: string;
	readonly port: number;
	readonly log_level: Log_Level;
	readonly serve?: Served_Dir_Partial[];
	readonly configBuild_Config: Build_Config;
	readonly system_build_config: Build_Config;
	readonly primaryBrowserBuild_Config: Build_Config | null; // TODO improve this, too rigid
}

export interface Gro_Config_Partial {
	readonly builds?: (Build_Config_Partial | null)[] | Build_Config_Partial | null; // allow `null` for convenience
	readonly publish?: string | null; // dir to publish: defaults to 'dist/library', or null if it doesn't exist -- TODO support multiple
	readonly adapt?: AdaptBuilds;
	readonly target?: EcmaScriptTarget;
	readonly sourcemap?: boolean;
	readonly host?: string;
	readonly port?: number;
	readonly log_level?: Log_Level;
	readonly serve?: Served_Dir_Partial[];
}

export interface Gro_Config_Module {
	readonly config: Gro_Config_Partial | Gro_Config_Creator;
}

export interface Gro_Config_Creator {
	(options: Gro_Config_Creator_Options): Gro_Config_Partial | Promise<Gro_Config_Partial>;
}
export interface Gro_Config_Creator_Options {
	// env: NodeJS.ProcessEnv; // TODO?
	readonly fs: Filesystem;
	readonly dev: boolean;
	readonly log: Logger;
	readonly config: Gro_Config; // default config is available for user config code
}

let cachedDevConfig: Gro_Config | undefined;
let cachedProdConfig: Gro_Config | undefined;

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
	but this duplicates building in the normal case where `invoke_task` loads the config,
	and it fixes only a subset of issues caused by the config needing special build behavior.
	Instead, we simply return the bootstrapped config and expect it to be correct.

*/

const applyConfig = (config: Gro_Config) => {
	// other things?
	configureLog_Level(config.log_level);
};

export const load_config = async (
	fs: Filesystem,
	dev: boolean,
	applyConfigToSystem = true,
): Promise<Gro_Config> => {
	const cachedConfig = dev ? cachedDevConfig : cachedProdConfig;
	if (cachedConfig) {
		if (applyConfigToSystem) applyConfig(cachedConfig);
		return cachedConfig;
	}

	const log = new SystemLogger(printLogLabel('config'));

	const options: Gro_Config_Creator_Options = {fs, log, dev, config: null as any};
	const defaultConfig = await to_config(createDefaultConfig, options, '');
	(options as Assignable<Gro_Config_Creator_Options, 'config'>).config = defaultConfig;

	const {config_source_id} = paths;
	let config: Gro_Config;
	if (await fs.exists(config_source_id)) {
		const {build_source_directory} = await import('../build/build_source_directory.js');
		const bootstrap_config = await to_config(
			{builds: [CONFIG_BUILD_CONFIG], sourcemap: dev},
			options,
			'gro/build/default_build_config.ts',
		);
		await build_source_directory(fs, bootstrap_config, dev, log);

		// The project has a `gro.config.ts`, so import it.
		// If it's not already built, we need to bootstrap the config and use it to compile everything.
		const configBuildId = to_build_out_path(dev, CONFIG_BUILD_CONFIG.name, CONFIG_BUILD_PATH);
		if (!(await fs.exists(configBuildId))) {
			throw Error('Cannot find config build id: ${configBuildId} from ${config_source_id}');
		}
		const configModule = await import(configBuildId);
		const validated = validateConfigModule(configModule);
		if (!validated.ok) {
			throw Error(`Invalid Gro config module at '${config_source_id}': ${validated.reason}`);
		}
		config = await to_config(configModule.config, options, config_source_id, defaultConfig);
	} else {
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

export const to_config = async (
	configOrCreator: Gro_Config_Partial | Gro_Config_Creator,
	options: Gro_Config_Creator_Options,
	path: string,
	baseConfig?: Gro_Config,
): Promise<Gro_Config> => {
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

const validateConfigModule = (configModule: any): Result<{}, {reason: string}> => {
	if (!(typeof configModule.config === 'function' || typeof configModule.config === 'object')) {
		throw Error(`Invalid Gro config module. Expected a 'config' export.`);
	}
	return {ok: true};
};

const validateConfig = async (
	fs: Filesystem,
	config: Gro_Config,
): Promise<Result<{}, {reason: string}>> => {
	const build_configsResult = await validate_build_configs(fs, config.builds);
	if (!build_configsResult.ok) return build_configsResult;
	return {ok: true};
};

const normalizeConfig = (config: Gro_Config_Partial): Gro_Config => {
	const build_configs = normalize_build_configs(toArray(config.builds || null));
	return {
		sourcemap: process.env.NODE_ENV !== 'production', // TODO maybe default to tsconfig?
		host: DEFAULT_SERVER_HOST,
		port: DEFAULT_SERVER_PORT,
		log_level: DEFAULT_LOG_LEVEL,
		adapt: () => null,
		...omitUndefined(config),
		builds: build_configs,
		publish:
			config.publish || config.publish === null
				? config.publish
				: toDefaultPublishDirs(build_configs),
		target: config.target || DEFAULT_ECMA_SCRIPT_TARGET,
		configBuild_Config: build_configs.find((b) => isConfigBuild_Config(b))!,
		system_build_config: build_configs.find((b) => is_system_build_config(b))!,
		// TODO instead of `primary` build configs, we want to be able to mount any number of them at once,
		// so this is a temp hack that just chooses the first browser build
		primaryBrowserBuild_Config: build_configs.find((b) => b.platform === 'browser') || null,
	};
};

const toDefaultPublishDirs = (build_configs: Build_Config[]): string | null => {
	const build_configToPublish = build_configs.find((b) => b.name === NODE_LIBRARY_BUILD_NAME);
	return build_configToPublish ? `${DIST_DIRNAME}/${build_configToPublish.name}` : null;
};
