import {loadPackageJson} from './packageJson.js';

// See `./buildConfig.md` for documentation.

export interface BuildConfig {
	readonly name: string;
	readonly platform: PlatformTarget;
	readonly dist?: boolean;
}

export type PlatformTarget = 'node' | 'browser';

const defaultBuildConfig: BuildConfig[] = [{name: 'browser', platform: 'browser'}];

export const loadBuildConfigs = async (): Promise<BuildConfig[]> => {
	const pkg = (await loadPackageJson()) as any;
	const buildConfigs: unknown = pkg.gro?.builds;
	if (buildConfigs) {
		return validateBuildConfigs(buildConfigs);
	} else {
		return defaultBuildConfig;
	}
};

const validateBuildConfigs = (buildConfigs: unknown): BuildConfig[] => {
	if (!Array.isArray(buildConfigs)) {
		throw Error('The field "gro.builds" in package.json must be an array');
	}
	if (!buildConfigs.length) {
		throw Error('The field "gro.builds" in package.json must have at least one entry.');
	}
	// TODO replace this with JSON schema validation
	for (const buildConfig of buildConfigs) {
		if (!buildConfig?.name || !buildConfig?.platform) {
			throw Error(
				'The field "gro.builds" in package.json has an item ' +
					` that does not match the BuildConfig interface: ${buildConfig}`,
			);
		}
	}
	return buildConfigs;
};
