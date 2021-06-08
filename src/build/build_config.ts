import {resolve} from 'path';
import {to_array} from '@feltcoop/felt/util/array.js';
import {blue, gray} from '@feltcoop/felt/util/terminal.js';
import type {Result, Flavored} from '@feltcoop/felt/util/types.js';

import {paths} from '../paths.js';
import {
	CONFIG_BUILD_CONFIG,
	CONFIG_BUILD_NAME,
	SYSTEM_BUILD_CONFIG,
	SYSTEM_BUILD_NAME,
} from './default_build_config.js';
import {validate_input_files} from './utils.js';
import type {Filesystem} from '../fs/filesystem.js';

// See `../docs/config.md` for documentation.

export type Build_Name = Flavored<string, 'Build_Name'>;

export interface Build_Config<T_Platform_Target extends string = Platform_Target> {
	readonly name: Build_Name;
	readonly platform: T_Platform_Target;
	readonly input: readonly Build_Config_Input[];
}

// `string` inputs must be a relative or absolute path to a source file
export type Build_Config_Input = string | Input_Filter;

export interface Input_Filter {
	(id: string): boolean;
}

export const to_input_files = (input: readonly Build_Config_Input[]): string[] =>
	input.filter((input) => typeof input === 'string') as string[];

export const to_input_filters = (input: readonly Build_Config_Input[]): Input_Filter[] =>
	input.filter((input) => typeof input !== 'string') as Input_Filter[];

// The partial was originally this calculated type, but it's a lot less readable.
// export type Build_Config_Partial = Partial_Except<
// 	Omit_Strict<Build_Config, 'input'> & {readonly input: string | string[]},
// 	'name' | 'platform'
// >;
export interface Build_Config_Partial {
	readonly name: Build_Name;
	readonly platform: Platform_Target;
	readonly input: Build_Config_Input | readonly Build_Config_Input[];
}

export type Platform_Target = 'node' | 'browser';

export const is_system_build_config = (config: Build_Config): boolean =>
	config.name === SYSTEM_BUILD_NAME;

export const is_config_build_config = (config: Build_Config): boolean =>
	config.name === CONFIG_BUILD_NAME;

export const normalize_build_configs = (
	partials: readonly (Build_Config_Partial | null)[],
): Build_Config[] => {
	// This array may be mutated inside this function, but the objects inside remain immutable.
	const build_configs: Build_Config[] = [];
	let has_config_build_config = false;
	let has_system_build_config = false;
	for (const partial of partials) {
		if (!partial) continue;
		const build_config: Build_Config = {
			name: partial.name,
			platform: partial.platform,
			input: normalize_build_config_input(partial.input),
		};
		build_configs.push(build_config);
		if (!has_config_build_config && is_config_build_config(build_config)) {
			has_config_build_config = true;
		}
		if (!has_system_build_config && is_system_build_config(build_config)) {
			has_system_build_config = true;
		}
	}
	if (!has_system_build_config) {
		build_configs.unshift(SYSTEM_BUILD_CONFIG);
	}
	if (!has_config_build_config) {
		build_configs.unshift(CONFIG_BUILD_CONFIG);
	}
	return build_configs;
};

const normalize_build_config_input = (
	input: Build_Config_Partial['input'],
): Build_Config['input'] =>
	to_array(input as any[]).map((v) => (typeof v === 'string' ? resolve(paths.source, v) : v));

// TODO replace this with JSON schema validation (or most of it at least)
export const validate_build_configs = async (
	fs: Filesystem,
	build_configs: Build_Config[],
): Promise<Result<{}, {reason: string}>> => {
	if (!Array.isArray(build_configs)) {
		return {
			ok: false,
			reason: `The field 'gro.builds' in package.json must be an array`,
		};
	}
	const config_build_config = build_configs.find((c) => is_config_build_config(c));
	if (!config_build_config) {
		return {
			ok: false,
			reason:
				`The field 'gro.builds' in package.json must have` +
				` a 'node' config named '${CONFIG_BUILD_NAME}'`,
		};
	}
	const system_build_config = build_configs.find((c) => is_system_build_config(c));
	if (!system_build_config) {
		return {
			ok: false,
			reason:
				`The field 'gro.builds' in package.json must have` +
				` a 'node' config named '${SYSTEM_BUILD_NAME}'`,
		};
	}
	const names: Set<Build_Name> = new Set();
	for (const build_config of build_configs) {
		if (
			!build_config ||
			!build_config.name ||
			!(build_config.platform === 'node' || build_config.platform === 'browser')
		) {
			return {
				ok: false,
				reason:
					`The field 'gro.builds' in package.json has an item` +
					` that does not match the Build_Config interface: ${JSON.stringify(build_config)}`,
			};
		}
		if (names.has(build_config.name)) {
			return {
				ok: false,
				reason:
					`The field 'gro.builds' in package.json cannot have items with duplicate names.` +
					` The name ${print_build_config(build_config)} appears twice.`,
			};
		}
		names.add(build_config.name);
		const validated_input = await validate_input_files(fs, to_input_files(build_config.input));
		if (!validated_input.ok) return validated_input;
	}
	return {ok: true};
};

export const print_build_config = (build_config: Build_Config): string => blue(build_config.name);
export const print_build_config_label = (build_config: Build_Config): string =>
	`${gray('build:')}${print_build_config(build_config)}`;
