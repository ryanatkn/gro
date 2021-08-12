import type {Builder} from 'src/build/builder.js';
import {EXTERNALS_SOURCE_ID} from './gro_builder_externals_utils.js';
import {JSON_EXTENSION, SVELTE_EXTENSION, TS_EXTENSION} from '../paths.js';
import {gro_builder_simple} from './gro_builder_simple.js';
import type {Options as SimpleBuilderOptions} from 'src/build/gro_builder_simple.js';
import {gro_builder_esbuild} from './gro_builder_esbuild.js';
import type {Options as EsbuildBuilderOptions} from 'src/build/gro_builder_esbuild.js';
import {gro_builder_svelte} from './gro_builder_svelte.js';
import type {Options as SvelteBuilderOptions} from 'src/build/gro_builder_svelte.js';
import {gro_builder_json} from './gro_builder_json.js';
import type {Options as JsonBuilderOptions} from 'src/build/gro_builder_json.js';
import {gro_builder_externals} from './gro_builder_externals.js';
import type {Options as ExternalsBuilderOptions} from 'src/build/gro_builder_externals.js';

export interface Options {
	esbuild_builder_options?: EsbuildBuilderOptions;
	svelte_builder_options?: SvelteBuilderOptions;
	json_builder_options?: JsonBuilderOptions;
	externals_builder_options?: ExternalsBuilderOptions;
	simple_builder_options?: SimpleBuilderOptions;
}

export const gro_builder_default = (options: Options = {}): Builder => {
	const {
		esbuild_builder_options,
		svelte_builder_options,
		json_builder_options,
		externals_builder_options,
		simple_builder_options,
	} = options;
	let final_simple_builder_options = simple_builder_options;
	if (!simple_builder_options?.to_builder) {
		const esbuild_builder = gro_builder_esbuild(esbuild_builder_options);
		const svelte_builder = gro_builder_svelte(svelte_builder_options);
		const json_builder = gro_builder_json(json_builder_options);
		const externals_builder = gro_builder_externals(externals_builder_options);
		const builders: Builder[] = [esbuild_builder, svelte_builder, externals_builder];
		final_simple_builder_options = {
			...simple_builder_options,
			to_builder: (source, build_config) => {
				if (source.id === EXTERNALS_SOURCE_ID) {
					if (build_config.platform !== 'browser') {
						throw Error('Expected browser for externals builder.');
					}
					return externals_builder;
				}
				switch (source.extension) {
					case TS_EXTENSION:
						return esbuild_builder;
					case SVELTE_EXTENSION:
						return svelte_builder;
					case JSON_EXTENSION:
						return json_builder;
					default:
						return null;
				}
			},
			to_builders: () => builders,
		};
	}

	return {
		...gro_builder_simple(final_simple_builder_options),
		name: '@feltcoop/gro_builder_default',
	};
};
