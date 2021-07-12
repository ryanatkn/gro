import type {Builder} from 'src/build/builder.js';
import {EXTERNALS_SOURCE_ID} from './gro_builder_externals_utils.js';
import {SVELTE_EXTENSION, TS_EXTENSION} from '../paths.js';
import {gro_builder_simple} from './gro_builder_simple.js';
import type {Initial_Options as Simple_Builder_Initial_Options} from 'src/build/gro_builder_simple.js';
import {gro_builder_esbuild} from './gro_builder_esbuild.js';
import type {Initial_Options as Esbuild_Builder_Initial_Options} from 'src/build/gro_builder_esbuild.js';
import {gro_builder_svelte} from './gro_builder_svelte.js';
import type {Initial_Options as Svelte_Builder_Initial_Options} from 'src/build/gro_builder_svelte.js';
import {gro_builder_externals} from './gro_builder_externals.js';
import type {Initial_Options as Externals_Builder_Initial_Options} from 'src/build/gro_builder_externals.js';

export const gro_builder_default = (
	esbuild_builder_options?: Esbuild_Builder_Initial_Options,
	svelte_builder_options?: Svelte_Builder_Initial_Options,
	externals_builder_options?: Externals_Builder_Initial_Options,
	simple_builder_options?: Simple_Builder_Initial_Options,
): Builder => {
	if (!simple_builder_options?.get_builder) {
		const esbuild_builder = gro_builder_esbuild(esbuild_builder_options);
		const svelte_builder = gro_builder_svelte(svelte_builder_options);
		const externals_builder = gro_builder_externals(externals_builder_options);
		const builders: Builder[] = [esbuild_builder, svelte_builder, externals_builder];
		simple_builder_options = {
			...simple_builder_options,
			get_builder: (source, build_config) => {
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
					default:
						return null;
				}
			},
			get_builders: () => builders,
		};
	}

	return {...gro_builder_simple(simple_builder_options), name: '@feltcoop/gro_builder_default'};
};
