import {resolve} from 'path';
import {toArray} from '@feltcoop/felt/dist/utils/array.js';
import {blue, gray} from '@feltcoop/felt/dist/utils/terminal.js';
import type {Result, Flavored} from '@feltcoop/felt/dist/utils/types.js';

import {paths} from '../paths.js';
import {PRIMARY_NODE_BUILD_CONFIG, PRIMARY_NODE_BUILD_NAME} from './defaultBuildConfig.js';

// See `../docs/config.md` for documentation.

export type BuildName = Flavored<string, 'BuildName'>;

export interface BuildConfig<TPlatformTarget extends string = PlatformTarget> {
	readonly name: BuildName;
	readonly platform: TPlatformTarget;
	readonly input: readonly BuildConfigInput[];
}

export type BuildConfigInput = string | InputFilter;

export interface InputFilter {
	(id: string): boolean;
}

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

export const isPrimaryBuildConfig = (config: BuildConfig): boolean =>
	config.name === PRIMARY_NODE_BUILD_NAME;

export const normalizeBuildConfigs = (
	partials: readonly (BuildConfigPartial | null)[],
): BuildConfig[] => {
	// This array may be mutated inside this function, but the objects inside remain immutable.
	const buildConfigs: BuildConfig[] = [];
	let hasPrimaryBuildConfig = false;
	for (const partial of partials) {
		if (!partial) continue;
		const buildConfig: BuildConfig = {
			name: partial.name,
			platform: partial.platform,
			input: normalizeBuildConfigInput(partial.input),
		};
		buildConfigs.push(buildConfig);
		if (!hasPrimaryBuildConfig && isPrimaryBuildConfig(buildConfig)) {
			hasPrimaryBuildConfig = true;
		}
	}
	if (!hasPrimaryBuildConfig) {
		buildConfigs.unshift(PRIMARY_NODE_BUILD_CONFIG);
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
	const primaryBuildConfig = buildConfigs.find((b) => b.name === PRIMARY_NODE_BUILD_NAME);
	if (!primaryBuildConfig) {
		return {
			ok: false,
			reason:
				`The field 'gro.builds' in package.json must have` +
				` a 'node' config named '${PRIMARY_NODE_BUILD_NAME}'`,
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
