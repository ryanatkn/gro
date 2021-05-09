import {resolve} from 'path';

import {toArray} from '../utils/array.js';
import {paths} from '../paths.js';
import {blue, gray} from '../utils/terminal.js';
import type {Result} from '../index.js';

// See `../docs/config.md` for documentation.

export interface BuildConfig {
	readonly name: string;
	readonly platform: PlatformTarget;
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
	readonly name: string;
	readonly platform: PlatformTarget;
	readonly input: BuildConfigInput | readonly BuildConfigInput[];
}

export type PlatformTarget = 'node' | 'browser';

export const PRIMARY_NODE_BUILD_NAME = 'node';
export const isPrimaryBuildConfig = (config: BuildConfig): boolean =>
	config.name === PRIMARY_NODE_BUILD_NAME;

export const normalizeBuildConfigs = (
	partials: readonly (BuildConfigPartial | null)[],
): BuildConfig[] => {
	// This array may be mutated inside this function, but the objects inside remain immutable.
	const buildConfigs: BuildConfig[] = [];
	for (const buildConfig of partials) {
		if (!buildConfig) continue;
		buildConfigs.push({
			name: buildConfig.name,
			platform: buildConfig.platform,
			input: normalizeBuildConfigInput(buildConfig.input),
		});
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
	const names: Set<string> = new Set();
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
