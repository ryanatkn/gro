import {loadPackageJson} from './packageJson.js';

// See `../docs/buildConfig.md` for documentation.

export interface BuildConfig {
	readonly name: string;
	readonly platform: PlatformTarget;
	readonly dist?: boolean;
	readonly primary?: boolean;
}

export type PlatformTarget = 'node' | 'browser';

const defaultBuildConfig: BuildConfig[] = [{name: 'browser', platform: 'browser'}];

let cachedBuildConfigs: BuildConfig[] | null = null;
let cachedPrimaryConfig: BuildConfig | null = null;

export const loadBuildConfigs = async (forceRefresh = false): Promise<BuildConfig[]> => {
	if (cachedBuildConfigs && !forceRefresh) return cachedBuildConfigs;
	const pkg: any = await loadPackageJson(forceRefresh); // TODO type, generate from JSON schema
	const loadedBuildConfigs: unknown = pkg.gro?.builds;
	const validatedBuildConfigs = loadedBuildConfigs
		? validateBuildConfigs(loadedBuildConfigs)
		: defaultBuildConfig;
	cachedBuildConfigs = validatedBuildConfigs;
	return validatedBuildConfigs;
};

// TODO replace this with JSON schema validation (or most of it at least)
const validateBuildConfigs = (buildConfigs: unknown): BuildConfig[] => {
	if (!Array.isArray(buildConfigs)) {
		throw Error('The field "gro.builds" in package.json must be an array');
	}
	if (!buildConfigs.length) {
		throw Error('The field "gro.builds" in package.json must have at least one entry.');
	}
	if (buildConfigs.filter((c) => c.primary).length > 1) {
		throw Error(`The field "gro.builds" in package.json cannot have multiple primary items.`);
	}
	const names = new Set<string>();
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
	}
	return buildConfigs;
};

// The "primary" build config is the one that's used to run Node tasks.
// The order of precendence is
// 1) `"primary": true`, or if none exists,
// 2) the first Node config, or if still no match,
// 3) the first config in the array.
export const loadPrimaryBuildConfig = async (forceRefresh = false): Promise<BuildConfig> => {
	if (cachedPrimaryConfig && !forceRefresh) return cachedPrimaryConfig;
	const buildConfigs = await loadBuildConfigs(forceRefresh);
	const explicitPrimaryConfig = buildConfigs.find((c) => c.primary);
	if (explicitPrimaryConfig) return (cachedPrimaryConfig = explicitPrimaryConfig);
	const firstNodeConfig = buildConfigs.find((c) => c.platform === 'node');
	if (firstNodeConfig) return (cachedPrimaryConfig = firstNodeConfig);
	return (cachedPrimaryConfig = buildConfigs[0]);
};
