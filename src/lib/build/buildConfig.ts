import {resolve} from 'node:path';
import {toArray} from '@feltjs/util/array.js';
import {blue, gray} from 'kleur/colors';
import type {Result} from '@feltjs/util/result.js';
import type {Flavored} from '@feltjs/util/types.js';

import {paths} from '../path/paths.js';
import {validateInputFiles} from './helpers.js';
import type {Filesystem} from '../fs/filesystem.js';

// See `../docs/config.md` for documentation.

export type BuildName = Flavored<string, 'BuildName'>;

export interface BuildConfig {
	name: BuildName;
	input: BuildConfigInput[];
}

// `string` inputs must be a relative or absolute path to a source file
export type BuildConfigInput = string | InputFilter;

export interface InputFilter {
	(id: string): boolean;
}

export const toInputFiles = (input: BuildConfigInput[]): string[] =>
	input.filter((input) => typeof input === 'string') as string[];

export const toInputFilters = (input: BuildConfigInput[]): InputFilter[] =>
	input.filter((input) => typeof input !== 'string') as InputFilter[];

export interface BuildConfigPartial {
	name: BuildName;
	input: BuildConfigInput | BuildConfigInput[];
	types?: boolean;
}

export const normalizeBuildConfigs = (
	partials: ReadonlyArray<BuildConfigPartial | null>,
): BuildConfig[] => {
	// This array may be mutated inside this function, but the objects inside remain immutable.
	// The system build is ignored for dev mode.
	const build_configs: BuildConfig[] = [];
	for (const partial of partials) {
		if (!partial) continue;
		const buildConfig: BuildConfig = {
			name: partial.name,
			input: normalizeBuildConfigInput(partial.input),
		};
		build_configs.push(buildConfig);
	}
	return build_configs;
};

const normalizeBuildConfigInput = (input: BuildConfigPartial['input']): BuildConfig['input'] =>
	toArray(input as any[]).map((v) => (typeof v === 'string' ? resolve(paths.source, v) : v));

// TODO replace this with JSON schema validation (or most of it at least)
export const validateBuildConfigs = async (
	fs: Filesystem,
	build_configs: BuildConfig[],
): Promise<Result<object, {reason: string}>> => {
	if (!Array.isArray(build_configs)) {
		return {
			ok: false,
			reason: `The field 'gro.builds' in package.json must be an array`,
		};
	}
	const names: Set<BuildName> = new Set();
	for (const buildConfig of build_configs) {
		if (!buildConfig?.name) {
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
		const validatedInput = await validateInputFiles(fs, toInputFiles(buildConfig.input)); // eslint-disable-line no-await-in-loop
		if (!validatedInput.ok) return validatedInput;
	}
	return {ok: true};
};

export const printBuildConfig = (buildConfig: BuildConfig): string => blue(buildConfig.name);
export const printBuildConfigLabel = (buildConfig: BuildConfig): string =>
	`${gray('build:')}${printBuildConfig(buildConfig)}`;
