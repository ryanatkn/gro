import {resolve} from 'node:path';
import {toArray} from '@feltjs/util/array.js';
import {blue, gray} from 'kleur/colors';
import type {Result} from '@feltjs/util/result.js';
import type {Flavored} from '@feltjs/util/types.js';

import {paths} from '../util/paths.js';
import {validate_input_files} from './config.js';

// See `../docs/config.md` for documentation.

export type BuildName = Flavored<string, 'BuildName'>;

export interface BuildConfig {
	name: BuildName;
	input: BuildConfigInput[];
}

// `string` inputs must be a relative or absolute path to a source file
export type BuildConfigInput = Flavored<string, 'BuildConfigInput'>;

export interface BuildConfigPartial {
	name: BuildName;
	input: BuildConfigInput | BuildConfigInput[];
	types?: boolean;
}

export const normalize_build_configs = (
	partials: ReadonlyArray<BuildConfigPartial | null>,
): BuildConfig[] => {
	// This array may be mutated inside this function, but the objects inside remain immutable.
	const build_configs: BuildConfig[] = [];
	for (const partial of partials) {
		if (!partial) continue;
		const build_config: BuildConfig = {
			name: partial.name,
			input: normalize_build_config_input(partial.input),
		};
		build_configs.push(build_config);
	}
	return build_configs;
};

const normalize_build_config_input = (input: BuildConfigPartial['input']): BuildConfig['input'] =>
	toArray(input).map((v) => resolve(paths.source, v));

// TODO make a zod schema and parse
export const validate_build_configs = async (
	build_configs: BuildConfig[],
): Promise<Result<object, {reason: string}>> => {
	if (!Array.isArray(build_configs)) {
		return {
			ok: false,
			reason: `The field 'gro.builds' in package.json must be an array`,
		};
	}
	const names: Set<BuildName> = new Set();
	for (const build_config of build_configs) {
		if (!build_config?.name) {
			return {
				ok: false,
				reason:
					`The field 'gro.builds' in package.json has an item` +
					` that does not match the BuildConfig interface: ${JSON.stringify(build_config)}`,
			};
		}
		if (names.has(build_config.name)) {
			return {
				ok: false,
				reason:
					`The field 'gro.builds' in package.json cannot have items with duplicate names.` +
					` The name ${print_build_config(build_config)} appears twice.`,
			};
		}
		names.add(build_config.name);
		const validated_input = await validate_input_files(build_config.input); // eslint-disable-line no-await-in-loop
		if (!validated_input.ok) return validated_input;
	}
	return {ok: true};
};

export const print_build_config = (build_config: BuildConfig): string => blue(build_config.name);
export const print_build_config_label = (build_config: BuildConfig): string =>
	`${gray('build:')}${print_build_config(build_config)}`;
