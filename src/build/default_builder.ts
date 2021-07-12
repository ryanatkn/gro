import type {Builder} from 'src/build/builder.js';
import {EXTERNALS_SOURCE_ID} from './externals_build_helpers.js';
import {SVELTE_EXTENSION, TS_EXTENSION} from '../paths.js';
import {create_simple_builder} from './simple_builder.js';
import type {Initial_Options as Simple_Builder_Initial_Options} from 'src/build/simple_builder.js';
import {create_esbuild_builder} from './esbuild_builder.js';
import type {Initial_Options as Esbuild_Builder_Initial_Options} from 'src/build/esbuild_builder.js';
import {create_svelte_builder} from './svelte_builder.js';
import type {Initial_Options as Svelte_Builder_Initial_Options} from 'src/build/svelte_builder.js';
import {create_externals_builder} from './externals_builder.js';
import type {Initial_Options as Externals_Builder_Initial_Options} from 'src/build/externals_builder.js';

export const create_default_builder = (
	esbuild_builder_options?: Esbuild_Builder_Initial_Options,
	svelte_builder_options?: Svelte_Builder_Initial_Options,
	externals_builder_options?: Externals_Builder_Initial_Options,
	simple_builder_options?: Simple_Builder_Initial_Options,
): Builder => {
	if (!simple_builder_options?.get_builder) {
		const esbuild_builder = create_esbuild_builder(esbuild_builder_options);
		const svelte_builder = create_svelte_builder(svelte_builder_options);
		const externals_builder = create_externals_builder(externals_builder_options);
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

	return {...create_simple_builder(simple_builder_options), name: '@feltcoop/gro_builder_default'};
};
