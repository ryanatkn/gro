import {resolve} from 'path';
import {toArray} from '@feltcoop/felt/utils/array.js';
import {blue, gray} from '@feltcoop/felt/utils/terminal.js';
import type {Result, Flavored} from '@feltcoop/felt/utils/types.js';

import {paths} from '../paths.js';
import {
	CONFIG_BUILD_CONFIG,
	CONFIG_BUILD_NAME,
	SYSTEM_BUILD_CONFIG,
	SYSTEM_BUILD_NAME,
} from './defaultBuildConfig.js';

// See `../docs/config.md` for documentation.

export type BuildName = Flavored<string, 'BuildName'>;

export interface BuildConfig<TPlatformTarget extends string = PlatformTarget> {
	readonly name: BuildName;
	readonly platform: TPlatformTarget;
	readonly input: readonly BuildConfigInput[];
}

// `string` inputs must be a relative or absolute path to a source file
export type BuildConfigInput = string | InputFilter;

export interface InputFilter {
	(id: string): boolean;
}

export const toInputFiles = (input: readonly BuildConfigInput[]): string[] =>
	input.filter((input) => typeof input === 'string') as string[];

export const toInputFilters = (input: readonly BuildConfigInput[]): InputFilter[] =>
	input.filter((input) => typeof input !== 'string') as InputFilter[];

// The partial was originally this calculated type, but it's a lot less readable.
// export type BuildConfigPartial = PartialExcept<
// 	OmitStrict<BuildConfig, 'input'> & {readonly input: string | string[]},
// 	'name' | 'platform'
// >;
export interface BuildConfigPartial {
	readonly name: BuildName;
	readonly platform: PlatformTarget;
	readonly input: BuildConfigInput | readonly BuildConfigInput[];
}

export type PlatformTarget = 'node' | 'browser';

export const isSystemBuildConfig = (config: BuildConfig): boolean =>
	config.name === SYSTEM_BUILD_NAME;

export const isConfigBuildConfig = (config: BuildConfig): boolean =>
	config.name === CONFIG_BUILD_NAME;

export const normalizeBuildConfigs = (
	partials: readonly (BuildConfigPartial | null)[],
): BuildConfig[] => {
	// This array may be mutated inside this function, but the objects inside remain immutable.
	const buildConfigs: BuildConfig[] = [];
	let hasConfigBuildConfig = false;
	let hasSystemBuildConfig = false;
	for (const partial of partials) {
		if (!partial) continue;
		const buildConfig: BuildConfig = {
			name: partial.name,
			platform: partial.platform,
			input: normalizeBuildConfigInput(partial.input),
		};
		buildConfigs.push(buildConfig);
		if (!hasConfigBuildConfig && isConfigBuildConfig(buildConfig)) {
			hasConfigBuildConfig = true;
		}
		if (!hasSystemBuildConfig && isSystemBuildConfig(buildConfig)) {
			hasSystemBuildConfig = true;
		}
	}
	if (!hasSystemBuildConfig) {
		buildConfigs.unshift(SYSTEM_BUILD_CONFIG);
	}
	if (!hasConfigBuildConfig) {
		buildConfigs.unshift(CONFIG_BUILD_CONFIG);
	}
	return buildConfigs;
};

const normalizeBuildConfigInput = (input: BuildConfigPartial['input']): BuildConfig['input'] =>
	toArray(input as any[]).map((v) => (typeof v === 'string' ? resolve(paths.source, v) : v));

// TODO replace this with JSON schema validation (or most of it at least)
export const validateBuildConfigs = (buildConfigs: BuildConfig[]): Result<{}, {reason: string}> => {
	if (!Array.isArray(buildConfigs)) {
		return {
			ok: false,
			reason: `The field 'gro.builds' in package.json must be an array`,
		};
	}
	const configBuildConfig = buildConfigs.find((c) => isConfigBuildConfig(c));
	if (!configBuildConfig) {
		return {
			ok: false,
			reason:
				`The field 'gro.builds' in package.json must have` +
				` a 'node' config named '${CONFIG_BUILD_NAME}'`,
		};
	}
	const systemBuildConfig = buildConfigs.find((c) => isSystemBuildConfig(c));
	if (!systemBuildConfig) {
		return {
			ok: false,
			reason:
				`The field 'gro.builds' in package.json must have` +
				` a 'node' config named '${SYSTEM_BUILD_NAME}'`,
		};
	}
	const names: Set<BuildName> = new Set();
	for (const buildConfig of buildConfigs) {
		if (
			!buildConfig ||
			!buildConfig.name ||
			!(buildConfig.platform === 'node' || buildConfig.platform === 'browser')
		) {
			return {
				ok: false,
				reason:
					`The field 'gro.builds' in package.json has an item` +
					` that does not match the BuildConfig interface: ${JSON.stringify(buildConfig)}`,
			};
		}
		if (names.has(buildConfig.name)) {
			return {
				ok: false,
				reason:
					`The field 'gro.builds' in package.json cannot have items with duplicate names.` +
					` The name ${printBuildConfig(buildConfig)} appears twice.`,
			};
		}
		names.add(buildConfig.name);
	}
	return {ok: true};
};

export const printBuildConfig = (buildConfig: BuildConfig): string => blue(buildConfig.name);
export const printBuildConfigLabel = (buildConfig: BuildConfig): string =>
	`${gray('build:')}${printBuildConfig(buildConfig)}`;
