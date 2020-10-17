// See `../docs/config.md` for documentation.

export interface BuildConfig {
	readonly name: string;
	readonly platform: PlatformTarget;
	readonly dist: boolean;
	readonly primary: boolean;
}

export type PartialBuildConfig = PartialExcept<BuildConfig, 'name' | 'platform'>;

export type PlatformTarget = 'node' | 'browser';

export const normalizeBuildConfigs = (
	partials: PartialBuildConfig[] | undefined,
): BuildConfig[] => {
	if (partials === undefined) partials = [];
	const platforms: Set<string> = new Set();
	const primaryPlatforms: Set<string> = new Set();

	// If there is no Node config, add one.
	if (!partials.some((p) => p.platform === 'node')) {
		partials.push({name: 'node', platform: 'node', primary: true, dist: false});
	}

	const hasDist = partials.some((b) => b.dist);

	// This array may be mutated inside this function, but the objects inside remain immutable.
	let buildConfigs: BuildConfig[] = partials.map((buildConfig) => ({
		primary: false,
		...buildConfig,
		dist: hasDist ? buildConfig.dist ?? false : true, // If no config is marked as `dist`, assume they all are.
	}));

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

// TODO replace this with JSON schema validation (or most of it at least)
export const validateBuildConfigs = (
	buildConfigs: PartialBuildConfig[] | undefined,
): Result<{}, {reason: string}> => {
	if (buildConfigs === undefined) return {ok: true};
	if (!Array.isArray(buildConfigs)) {
		return {
			ok: false,
			reason: 'The field "gro.builds" in package.json must be an array or undefined',
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
					'The field "gro.builds" in package.json has an item' +
					` that does not match the BuildConfig interface: ${JSON.stringify(buildConfig)}`,
			};
		}
		if (names.has(buildConfig.name)) {
			return {
				ok: false,
				reason:
					'The field "gro.builds" in package.json cannot have items with duplicate names.' +
					` The name '${buildConfig.name}' appears twice.`,
			};
		}
		names.add(buildConfig.name);
		// Disallow multiple primary configs for each platform.
		if (buildConfig.primary) {
			if (primaryPlatforms.has(buildConfig.platform)) {
				return {
					ok: false,
					reason:
						'The field "gro.builds" in package.json cannot have' +
						` multiple primary items for platform "${buildConfig.platform}".`,
				};
			}
			primaryPlatforms.add(buildConfig.platform);
		}
	}
	return {ok: true};
};
