import {Logger, SystemLogger, printLogLabel} from '@feltjs/util/log.js';
import {omitUndefined} from '@feltjs/util/object.js';
import type {Result} from '@feltjs/util/result.js';
import type {Assignable, Flavored} from '@feltjs/util/types.js';

import {paths} from '../util/paths.js';
import type {ToConfigAdapters} from '../adapt/adapt.js';
import createDefaultConfig from './gro.config.default.js';
import type {ToConfigPlugins} from '../plugin/plugin.js';
import {exists} from '../util/exists.js';

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
	readonly plugin: ToConfigPlugins;
	readonly adapt: ToConfigAdapters;
	readonly target: EcmaScriptTarget;
	readonly sourcemap: boolean;
}

export interface GroConfigPartial {
	readonly plugin?: ToConfigPlugins;
	readonly adapt?: ToConfigAdapters;
	readonly target?: EcmaScriptTarget;
	readonly sourcemap?: boolean;
}

export interface GroConfigModule {
	readonly default: GroConfigPartial | GroConfigCreator;
}

export interface GroConfigCreator {
	(options: GroConfigCreatorOptions): GroConfigPartial | Promise<GroConfigPartial>;
}
export interface GroConfigCreatorOptions {
	// env: NodeJS.ProcessEnv; // TODO?
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
	but this duplicates building in the normal case where `invoke_task` loads the config,
	and it fixes only a subset of issues caused by the config needing special build behavior.
	Instead, we simply return the bootstrapped config and expect it to be correct.

*/

let cached_config: Promise<GroConfig> | undefined;

export const load_config = (): Promise<GroConfig> =>
	cached_config || (cached_config = _load_config());

const _load_config = async (): Promise<GroConfig> => {
	const log = new SystemLogger(printLogLabel('config'));

	const options: GroConfigCreatorOptions = {log, config: null as any};
	const default_config = await create_config(createDefaultConfig, options);
	(options as Assignable<GroConfigCreatorOptions, 'config'>).config = default_config;

	const config_path = paths.config;
	let config: GroConfig;
	if (await exists(config_path)) {
		const config_module = await import(config_path);
		validate_config_module(config_module, config_path);
		config = await create_config(config_module.default, options, default_config);
	} else {
		config = default_config;
	}
	return config;
};

export const create_config = async (
	config_or_creator: GroConfigPartial | GroConfigCreator,
	options: GroConfigCreatorOptions,
	base_config?: GroConfig,
): Promise<GroConfig> => {
	const config_partial =
		typeof config_or_creator === 'function' ? await config_or_creator(options) : config_or_creator;

	const extended_config = base_config ? {...base_config, ...config_partial} : config_partial;

	const config = normalize_config(extended_config);

	return config;
};

export const validate_config_module: (
	config_module: any,
	config_path: string,
) => asserts config_module is GroConfigModule = (config_module, config_path) => {
	const config = config_module.default;
	if (!config) {
		throw Error(`Invalid Gro config module at ${config_path}: expected a default export`);
	} else if (!(typeof config === 'function' || typeof config === 'object')) {
		throw Error(
			`Invalid Gro config module at ${config_path}: the default export must be a function or object`,
		);
	}
};

export const normalize_config = (config: GroConfigPartial): GroConfig => {
	return {
		sourcemap: true,
		plugin: () => null,
		adapt: () => null,
		...omitUndefined(config),
		target: config.target || 'esnext',
	};
};

export const validate_input_files = async (
	files: string[],
): Promise<Result<object, {reason: string}>> => {
	const results = await Promise.all(
		files.map(async (input): Promise<{ok: false; reason: string} | null> => {
			if (!(await exists(input))) {
				return {ok: false, reason: `Input file does not exist: ${input}`};
			}
			return null;
		}),
	);
	for (const result of results) {
		if (result) return result;
	}
	return {ok: true};
};

export type EcmaScriptTarget = Flavored<string, 'EcmaScriptTarget'>;
