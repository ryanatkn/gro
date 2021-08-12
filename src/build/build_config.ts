import {resolve} from 'path';
import {to_array} from '@feltcoop/felt/util/array.js';
import {blue, gray} from '@feltcoop/felt/util/terminal.js';
import type {Result, Flavored} from '@feltcoop/felt/util/types.js';

import {paths} from '../paths.js';
import {
	CONFIG_BUILD_NAME,
	SYSTEM_BUILD_CONFIG,
	SYSTEM_BUILD_NAME,
} from './build_config_defaults.js';
import {validate_input_files} from './utils.js';
import type {Filesystem} from 'src/fs/filesystem.js';

// See `../docs/config.md` for documentation.

export type BuildName = Flavored<string, 'BuildName'>;

export interface BuildConfig<T_PlatformTarget extends string = PlatformTarget> {
	readonly name: BuildName;
	readonly platform: T_PlatformTarget;
	readonly input: readonly BuildConfigInput[];
}

// `string` inputs must be a relative or absolute path to a source file
export type BuildConfigInput = string | InputFilter;

export interface InputFilter {
	(id: string): boolean;
}

export const to_input_files = (input: readonly BuildConfigInput[]): string[] =>
	input.filter((input) => typeof input === 'string') as string[];

export const to_input_filters = (input: readonly BuildConfigInput[]): InputFilter[] =>
	input.filter((input) => typeof input !== 'string') as InputFilter[];

// The partial was originally this calculated type, but it's a lot less readable.
// export type BuildConfigPartial = Partial_Except<
// 	Omit_Strict<BuildConfig, 'input'> & {readonly input: string | string[]},
// 	'name' | 'platform'
// >;
export interface BuildConfigPartial {
	readonly name: BuildName;
	readonly platform: PlatformTarget;
	readonly input: BuildConfigInput | readonly BuildConfigInput[];
}

export type PlatformTarget = 'node' | 'browser';

export const normalize_build_configs = (
	partials: readonly (BuildConfigPartial | null)[],
	dev: boolean,
): BuildConfig[] => {
	// This array may be mutated inside this function, but the objects inside remain immutable.
	// The system build is ignored for dev mode.
	const build_configs: BuildConfig[] = [];
	let should_add_system_build_config = dev; // add system build only for dev, not prod
	for (const partial of partials) {
		if (!partial) continue;
		const build_config: BuildConfig = {
			name: partial.name,
			platform: partial.platform,
			input: normalize_build_config_input(partial.input),
		};
		build_configs.push(build_config);
		if (should_add_system_build_config && build_config.name === SYSTEM_BUILD_NAME) {
			should_add_system_build_config = false;
		}
	}
	if (should_add_system_build_config) {
		build_configs.unshift(SYSTEM_BUILD_CONFIG);
	}
	return build_configs;
};

const normalize_build_config_input = (input: BuildConfigPartial['input']): BuildConfig['input'] =>
	to_array(input as any[]).map((v) => (typeof v === 'string' ? resolve(paths.source, v) : v));

// TODO replace this with JSON schema validation (or most of it at least)
export const validate_build_configs = async (
	fs: Filesystem,
	build_configs: BuildConfig[],
	dev: boolean,
): Promise<Result<{}, {reason: string}>> => {
	if (!Array.isArray(build_configs)) {
		return {
			ok: false,
			reason: `The field 'gro.builds' in package.json must be an array`,
		};
	}
	const config_build_config = build_configs.find((c) => c.name === CONFIG_BUILD_NAME);
	if (config_build_config) {
		return {
			ok: false,
			reason:
				`The field 'gro.builds' in package.json has` +
				` a 'node' config with reserved name '${CONFIG_BUILD_NAME}'`,
		};
	}
	const system_build_config = build_configs.find((c) => c.name === SYSTEM_BUILD_NAME);
	if (!dev && system_build_config) {
		return {
			ok: false,
			reason:
				`The field 'gro.builds' in package.json has` +
				` a 'node' config named '${SYSTEM_BUILD_NAME}'` +
				' for production but it is valid only in development',
		};
	}
	const names: Set<BuildName> = new Set();
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
					` that does not match the BuildConfig interface: ${JSON.stringify(build_config)}`,
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

export const print_build_config = (build_config: BuildConfig): string => blue(build_config.name);
export const print_build_config_label = (build_config: BuildConfig): string =>
	`${gray('build:')}${print_build_config(build_config)}`;
