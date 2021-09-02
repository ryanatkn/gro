import {resolve} from 'path';
import {toArray} from '@feltcoop/felt/util/array.js';
import {blue, gray} from '@feltcoop/felt/util/terminal.js';
import type {Result, Flavored} from '@feltcoop/felt/util/types.js';

import {paths} from '../paths.js';
import {CONFIG_BUILD_NAME, SYSTEM_BUILD_CONFIG, SYSTEM_BUILD_NAME} from './buildConfigDefaults.js';
import {validateInputFiles} from './utils.js';
import type {Filesystem} from 'src/fs/filesystem.js';

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

export const normalizeBuildConfigs = (
	partials: readonly (BuildConfigPartial | null)[],
	dev: boolean,
): BuildConfig[] => {
	// This array may be mutated inside this function, but the objects inside remain immutable.
	// The system build is ignored for dev mode.
	const buildConfigs: BuildConfig[] = [];
	let shouldAddSystemBuildConfig = dev; // add system build only for dev, not prod
	for (const partial of partials) {
		if (!partial) continue;
		const buildConfig: BuildConfig = {
			name: partial.name,
			platform: partial.platform,
			input: normalizeBuildConfigInput(partial.input),
		};
		buildConfigs.push(buildConfig);
		if (shouldAddSystemBuildConfig && buildConfig.name === SYSTEM_BUILD_NAME) {
			shouldAddSystemBuildConfig = false;
		}
	}
	if (shouldAddSystemBuildConfig) {
		buildConfigs.unshift(SYSTEM_BUILD_CONFIG);
	}
	return buildConfigs;
};

const normalizeBuildConfigInput = (input: BuildConfigPartial['input']): BuildConfig['input'] =>
	toArray(input as any[]).map((v) => (typeof v === 'string' ? resolve(paths.source, v) : v));

// TODO replace this with JSON schema validation (or most of it at least)
export const validateBuildConfigs = async (
	fs: Filesystem,
	buildConfigs: BuildConfig[],
	dev: boolean,
): Promise<Result<{}, {reason: string}>> => {
	if (!Array.isArray(buildConfigs)) {
		return {
			ok: false,
			reason: `The field 'gro.builds' in package.json must be an array`,
		};
	}
	const configBuildConfig = buildConfigs.find((c) => c.name === CONFIG_BUILD_NAME);
	if (configBuildConfig) {
		return {
			ok: false,
			reason:
				`The field 'gro.builds' in package.json has` +
				` a 'node' config with reserved name '${CONFIG_BUILD_NAME}'`,
		};
	}
	const systemBuildConfig = buildConfigs.find((c) => c.name === SYSTEM_BUILD_NAME);
	if (!dev && systemBuildConfig) {
		return {
			ok: false,
			reason:
				`The field 'gro.builds' in package.json has` +
				` a 'node' config named '${SYSTEM_BUILD_NAME}'` +
				' for production but it is valid only in development',
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
		const validatedInput = await validateInputFiles(fs, toInputFiles(buildConfig.input));
		if (!validatedInput.ok) return validatedInput;
	}
	return {ok: true};
};

export const printBuildConfig = (buildConfig: BuildConfig): string => blue(buildConfig.name);
export const printBuildConfigLabel = (buildConfig: BuildConfig): string =>
	`${gray('build:')}${printBuildConfig(buildConfig)}`;
