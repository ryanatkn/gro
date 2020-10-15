import {GroConfig} from './config.js';

// See `../docs/config.md` for documentation.

export interface BuildConfig {
	readonly name: string;
	readonly platform: PlatformTarget;
	readonly dist?: boolean;
	readonly primary?: boolean;
}

export type PlatformTarget = 'node' | 'browser';

// The "primary" build config is the one that's used to run Node tasks.
// The order of precendence is:
// 1) the build config marked `"primary": true`,
// 2) or if none exists, the first Node build config,
// 3) or if still no match, the first build config
// TODO we may need the concept of a primary config for each platform,
// or something else that answers the question
// "which config should we serve in the browser by default"?
export const findPrimaryBuildConfig = (config: GroConfig): BuildConfig => {
	let firstNodeBuildConfig;
	for (const buildConfig of config.builds) {
		if (buildConfig.primary) return buildConfig;
		if (firstNodeBuildConfig === undefined && buildConfig.platform === 'node') {
			firstNodeBuildConfig = buildConfig;
		}
	}
	return firstNodeBuildConfig || config.builds[0];
};

export const findDistBuildConfigs = (config: GroConfig): BuildConfig[] =>
	config.builds.some((c) => c.dist) ? config.builds.filter((c) => c.dist) : config.builds;

// TODO replace this with JSON schema validation (or most of it at least)
export const validateBuildConfigs = (buildConfigs: unknown): BuildConfig[] => {
	if (!Array.isArray(buildConfigs)) {
		throw Error('The field "gro.builds" in package.json must be an array');
	}
	if (!buildConfigs.length) {
		throw Error('The field "gro.builds" in package.json must have at least one entry.');
	}
	const names = new Set<string>();
	let primaryCount = 0;
	for (const buildConfig of buildConfigs) {
		if (
			!buildConfig ||
			!buildConfig.name ||
			!(buildConfig.platform === 'node' || buildConfig.platform === 'browser')
		) {
			throw Error(
				'The field "gro.builds" in package.json has an item' +
					` that does not match the BuildConfig interface: ${JSON.stringify(buildConfig)}`,
			);
		}
		if (names.has(buildConfig.name)) {
			throw Error(
				'The field "gro.builds" in package.json cannot have items with duplicate names.' +
					` The name '${buildConfig.name}' appears twice.`,
			);
		}
		names.add(buildConfig.name);
		if (buildConfig.primary) {
			primaryCount++;
			if (primaryCount > 1) {
				throw Error(`The field "gro.builds" in package.json cannot have multiple primary items.`);
			}
		}
	}
	return buildConfigs;
};
