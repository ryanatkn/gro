import {isGroId, isThisProjectGro} from '../paths.js';
import {loadGroPackageJson, loadPackageJson} from '../project/packageJson.js';

// See `../docs/buildConfig.md` for documentation.

export interface BuildConfig {
	readonly name: string;
	readonly platform: PlatformTarget;
	readonly dist?: boolean;
	readonly primary?: boolean;
}

export type PlatformTarget = 'node' | 'browser';

export const loadBuildConfigsAt = (id: string): Promise<BuildConfig[]> =>
	isThisProjectGro || isGroId(id) ? loadGroBuildConfigs() : loadBuildConfigs();

export const loadPrimaryBuildConfigAt = (id: string): Promise<BuildConfig> =>
	isThisProjectGro || isGroId(id) ? loadGroPrimaryBuildConfig() : loadPrimaryBuildConfig();

const defaultBuildConfig: BuildConfig[] = [{name: 'browser', platform: 'browser'}];

// The "primary" build config is the one that's used to run Node tasks.
// The order of precendence is
// 1) `"primary": true`, or if none exists,
// 2) the first Node config, or if still no match,
// 3) the first config in the array.
let cachedBuildConfigs: BuildConfig[] | null = null;
let cachedPrimaryBuildConfig: BuildConfig | null = null;
export const loadBuildConfigs = async (forceRefresh = false): Promise<BuildConfig[]> => {
	if (isThisProjectGro) return loadGroBuildConfigs(forceRefresh); // cheaply avoid duplicate work
	if (cachedBuildConfigs && !forceRefresh) return cachedBuildConfigs;
	const pkg: any = await loadPackageJson(forceRefresh); // TODO type, generate from JSON schema
	const loadedBuildConfigs: unknown = pkg.gro?.builds;
	const validatedBuildConfigs = loadedBuildConfigs
		? validateBuildConfigs(loadedBuildConfigs)
		: defaultBuildConfig;
	cachedBuildConfigs = validatedBuildConfigs;
	cachedPrimaryBuildConfig = null;
	return validatedBuildConfigs;
};
export const loadPrimaryBuildConfig = async (forceRefresh = false): Promise<BuildConfig> => {
	if (isThisProjectGro) return loadGroPrimaryBuildConfig(forceRefresh); // cheaply avoid duplicate work
	if (cachedPrimaryBuildConfig && !forceRefresh) return cachedPrimaryBuildConfig;
	const buildConfigs = await loadBuildConfigs(forceRefresh);
	const explicitPrimaryConfig = buildConfigs.find((c) => c.primary);
	if (explicitPrimaryConfig) {
		return (cachedPrimaryBuildConfig = explicitPrimaryConfig);
	}
	const firstNodeConfig = buildConfigs.find((c) => c.platform === 'node');
	if (firstNodeConfig) {
		return (cachedPrimaryBuildConfig = firstNodeConfig);
	}
	return (cachedPrimaryBuildConfig = buildConfigs[0]);
};

let cachedGroBuildConfigs: BuildConfig[] | null = null;
let cachedGroPrimaryBuildConfig: BuildConfig | null = null;
export const loadGroBuildConfigs = async (forceRefresh = false): Promise<BuildConfig[]> => {
	if (cachedGroBuildConfigs && !forceRefresh) return cachedGroBuildConfigs;
	const pkg: any = await loadGroPackageJson(forceRefresh); // TODO type, generate from JSON schema
	cachedGroPrimaryBuildConfig = null;
	return (cachedGroBuildConfigs = pkg.gro.builds);
};
export const loadGroPrimaryBuildConfig = async (forceRefresh = false): Promise<BuildConfig> => {
	if (cachedGroPrimaryBuildConfig && !forceRefresh) return cachedGroPrimaryBuildConfig;
	const buildConfigs = await loadGroBuildConfigs(forceRefresh);
	return (cachedGroPrimaryBuildConfig = buildConfigs.find((c) => c.primary)!);
};

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
