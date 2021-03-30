import {resolve} from 'path';

import {ensureArray} from '../utils/array.js';
import {DEFAULT_BUILD_CONFIG_NAME} from './defaultBuildConfig.js';
import {paths} from '../paths.js';
import {blue} from '../utils/terminal.js';
import type {Result} from '../types.js';

// See `../docs/config.md` for documentation.

export interface BuildConfig {
	readonly name: string;
	readonly platform: PlatformTarget;
	readonly input: readonly BuildConfigInput[];
	readonly dist: boolean;
	readonly primary: boolean;
}

type BuildConfigInput = string | ((id: string) => boolean);

// The partial was originally this calculated type, but it's a lot less readable.
// export type PartialBuildConfig = PartialExcept<
// 	OmitStrict<BuildConfig, 'input'> & {readonly input: string | string[]},
// 	'name' | 'platform'
// >;
export interface PartialBuildConfig {
	readonly name: string;
	readonly platform: PlatformTarget;
	readonly input: BuildConfigInput | BuildConfigInput[];
	readonly dist?: boolean;
	readonly primary?: boolean;
}

export type PlatformTarget = 'node' | 'browser';

export const normalizeBuildConfigs = (partials: (PartialBuildConfig | null)[]): BuildConfig[] => {
	const platforms: Set<string> = new Set();
	const primaryPlatforms: Set<string> = new Set();

	const hasDist = partials.some((b) => b?.dist);

	// This array may be mutated inside this function, but the objects inside remain immutable.
	const buildConfigs: BuildConfig[] = [];
	for (const buildConfig of partials) {
		if (!buildConfig) continue;
		buildConfigs.push({
			name: buildConfig.name,
			platform: buildConfig.platform,
			input: normalizeBuildConfigInput(buildConfig.input),
			dist: hasDist ? buildConfig.dist ?? false : true, // If no config is marked as `dist`, assume they all are.
			primary: buildConfig.primary ?? false,
		});
	}

	for (const buildConfig of buildConfigs) {
		platforms.add(buildConfig.platform);
		if (buildConfig.primary) primaryPlatforms.add(buildConfig.platform);
	}

	for (const platform of platforms) {
		// If no config is marked as primary for a platform, choose the first one.
		if (!primaryPlatforms.has(platform)) {
			const firstIndexForPlatform = buildConfigs.findIndex((b) => b.platform === platform);
			buildConfigs[firstIndexForPlatform] = {...buildConfigs[firstIndexForPlatform], primary: true};
		}
	}

	return buildConfigs;
};

const normalizeBuildConfigInput = (input: PartialBuildConfig['input']): BuildConfig['input'] =>
	ensureArray(input).map((v) => (typeof v === 'string' ? resolve(paths.source, v) : v));

// TODO replace this with JSON schema validation (or most of it at least)
export const validateBuildConfigs = (buildConfigs: BuildConfig[]): Result<{}, {reason: string}> => {
	if (!Array.isArray(buildConfigs)) {
		return {
			ok: false,
			reason: `The field 'gro.builds' in package.json must be an array`,
		};
	}
	const names: Set<string> = new Set();
	const primaryPlatforms: Set<PlatformTarget> = new Set();
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
		// Disallow multiple primary configs for each platform.
		if (buildConfig.primary) {
			if (primaryPlatforms.has(buildConfig.platform)) {
				return {
					ok: false,
					reason:
						`The field 'gro.builds' in package.json cannot have` +
						` multiple primary items for platform "${buildConfig.platform}".`,
				};
			}
			if (buildConfig.platform === 'node' && buildConfig.name !== DEFAULT_BUILD_CONFIG_NAME) {
				return {
					ok: false,
					reason:
						`The field 'gro.builds' in package.json must name` +
						` its primary Node config '${DEFAULT_BUILD_CONFIG_NAME}'`,
				};
			}
			primaryPlatforms.add(buildConfig.platform);
		}
	}
	return {ok: true};
};

export const printBuildConfig = (buildConfig: BuildConfig): string => blue(buildConfig.name);
