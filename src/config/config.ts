import {
	Log_Level,
	System_Logger,
	configure_log_level,
	print_log_label,
	DEFAULT_LOG_LEVEL,
} from '@feltcoop/felt/util/log.js';
import type {Logger} from '@feltcoop/felt/util/log.js';
import {omit_undefined} from '@feltcoop/felt/util/object.js';
import type {Assignable, Result} from '@feltcoop/felt/util/types.js';
import {to_array} from '@feltcoop/felt/util/array.js';

import {paths, to_build_out_path, CONFIG_BUILD_PATH, DIST_DIRNAME} from '../paths.js';
import {normalize_build_configs, validate_build_configs} from '../build/build_config.js';
import type {Adapt_Builds} from '../adapt/adapter.js';
import type {Build_Config, Build_Config_Partial} from '../build/build_config.js';
import {
	DEFAULT_ECMA_SCRIPT_TARGET,
	NODE_LIBRARY_BUILD_NAME,
	CONFIG_BUILD_CONFIG,
	SYSTEM_BUILD_NAME,
} from '../build/default_build_config.js';
import type {Ecma_Script_Target} from '../build/ts_build_helpers.js';
import type {Served_Dir_Partial} from '../build/served_dir.js';
import {DEFAULT_SERVER_HOST, DEFAULT_SERVER_PORT} from '../server/server.js';
import type {Filesystem} from '../fs/filesystem.js';
import {config as create_default_config} from './gro.config.default.js';

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
	readonly adapt: Adapt_Builds;
	readonly target: Ecma_Script_Target;
	readonly sourcemap: boolean;
	readonly typemap: boolean;
	readonly host: string;
	readonly port: number;
	readonly log_level: Log_Level;
	readonly serve?: Served_Dir_Partial[];
	readonly system_build_config: Build_Config;
	readonly primary_browser_build_config: Build_Config | null; // TODO improve this, too rigid
}

export interface Gro_Config_Partial {
	readonly builds?: (Build_Config_Partial | null)[] | Build_Config_Partial | null; // allow `null` for convenience
	readonly publish?: string | null; // dir to publish: defaults to 'dist/library', or null if it doesn't exist -- TODO support multiple
	readonly adapt?: Adapt_Builds;
	readonly target?: Ecma_Script_Target;
	readonly sourcemap?: boolean;
	readonly typemap?: boolean;
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

let cached_dev_config: Gro_Config | undefined;
let cached_prod_config: Gro_Config | undefined;

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

const apply_config = (config: Gro_Config) => {
	// other things?
	configure_log_level(config.log_level);
};

export const load_config = async (
	fs: Filesystem,
	dev: boolean,
	apply_config_to_system = true,
): Promise<Gro_Config> => {
	const cached_config = dev ? cached_dev_config : cached_prod_config;
	if (cached_config) {
		if (apply_config_to_system) apply_config(cached_config);
		return cached_config;
	}

	const log = new System_Logger(print_log_label('config'));

	const options: Gro_Config_Creator_Options = {fs, log, dev, config: null as any};
	const default_config = await to_config(create_default_config, options, '');
	(options as Assignable<Gro_Config_Creator_Options, 'config'>).config = default_config;

	const {config_source_id} = paths;
	let config: Gro_Config;
	if (await fs.exists(config_source_id)) {
		const {build_source} = await import('../build/build_source.js');
		await build_source(fs, to_bootstrap_config(), dev, log, false);

		// The project has a `gro.config.ts`, so import it.
		// If it's not already built, we need to bootstrap the config and use it to compile everything.
		const config_build_id = to_build_out_path(dev, CONFIG_BUILD_CONFIG.name, CONFIG_BUILD_PATH);
		if (!(await fs.exists(config_build_id))) {
			throw Error(`Cannot find config build id: ${config_build_id} from ${config_source_id}`);
		}
		const config_module = await import(config_build_id);
		const validated = validate_config_module(config_module);
		if (!validated.ok) {
			throw Error(`Invalid Gro config module at '${config_source_id}': ${validated.reason}`);
		}
		config = await to_config(config_module.config, options, config_source_id, default_config);
	} else {
		config = default_config;
	}
	if (dev) {
		cached_dev_config = config;
	} else {
		cached_prod_config = config;
	}
	if (apply_config_to_system) apply_config(config);
	return config;
};

export const to_config = async (
	config_or_creator: Gro_Config_Partial | Gro_Config_Creator,
	options: Gro_Config_Creator_Options,
	path: string,
	base_config?: Gro_Config,
): Promise<Gro_Config> => {
	const config_partial =
		typeof config_or_creator === 'function' ? await config_or_creator(options) : config_or_creator;

	const extended_config = base_config ? {...base_config, ...config_partial} : config_partial;

	const config = normalize_config(extended_config, options.dev);

	const validate_result = await validate_config(options.fs, config, options.dev);
	if (!validate_result.ok) {
		throw Error(`Invalid Gro config at '${path}': ${validate_result.reason}`);
	}

	return config;
};

const to_bootstrap_config = (): Gro_Config => {
	return {
		sourcemap: false, // TODO or always true?
		typemap: false, // TODO or always true?
		host: DEFAULT_SERVER_HOST,
		port: DEFAULT_SERVER_PORT,
		log_level: DEFAULT_LOG_LEVEL,
		adapt: () => null,
		builds: [CONFIG_BUILD_CONFIG],
		publish: null,
		target: DEFAULT_ECMA_SCRIPT_TARGET,
		system_build_config: null!,
		primary_browser_build_config: null,
	};
};

const validate_config_module = (config_module: any): Result<{}, {reason: string}> => {
	if (!(typeof config_module.config === 'function' || typeof config_module.config === 'object')) {
		throw Error(`Invalid Gro config module. Expected a 'config' export.`);
	}
	return {ok: true};
};

const validate_config = async (
	fs: Filesystem,
	config: Gro_Config,
	dev: boolean,
): Promise<Result<{}, {reason: string}>> => {
	const build_configs_result = await validate_build_configs(fs, config.builds, dev);
	if (!build_configs_result.ok) return build_configs_result;
	return {ok: true};
};

const normalize_config = (config: Gro_Config_Partial, dev: boolean): Gro_Config => {
	const build_configs = normalize_build_configs(to_array(config.builds || null), dev);
	return {
		sourcemap: dev,
		typemap: !dev,
		host: DEFAULT_SERVER_HOST,
		port: DEFAULT_SERVER_PORT,
		log_level: DEFAULT_LOG_LEVEL,
		adapt: () => null,
		...omit_undefined(config),
		builds: build_configs,
		publish:
			config.publish || config.publish === null
				? config.publish
				: to_default_publish_dirs(build_configs),
		target: config.target || DEFAULT_ECMA_SCRIPT_TARGET,
		system_build_config: build_configs.find((b) => b.name === SYSTEM_BUILD_NAME)!,
		// TODO instead of `primary` build configs, we want to be able to mount any number of them at once,
		// so this is a temp hack that just chooses the first browser build
		primary_browser_build_config: build_configs.find((b) => b.platform === 'browser') || null,
	};
};

const to_default_publish_dirs = (build_configs: Build_Config[]): string | null => {
	const build_config_to_publish = build_configs.find((b) => b.name === NODE_LIBRARY_BUILD_NAME);
	return build_config_to_publish ? `${DIST_DIRNAME}/${build_config_to_publish.name}` : null;
};
