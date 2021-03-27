import {SVELTE_EXTENSION, TS_EXTENSION} from '../paths.js';
import type {Builder} from './builder.js';
import {createLazyBuilder, InitialOptions as LazyBuilderInitialOptions} from './lazyBuilder.js';
import {
	createEsbuildBuilder,
	InitialOptions as SwcBuilderInitialOptions,
} from './esbuildBuilder.js';
import {
	createSvelteBuilder,
	InitialOptions as SvelteBuilderInitialOptions,
} from './svelteBuilder.js';
import {
	createExternalsBuilder,
	InitialOptions as ExternalsBuilderInitialOptions,
} from './externalsBuilder.js';
import {EXTERNALS_SOURCE_ID} from './externalsBuildHelpers.js';

export const createDefaultBuilder = (
	esbuildBuilderOptions?: SwcBuilderInitialOptions,
	svelteBuilderOptions?: SvelteBuilderInitialOptions,
	externalsBuilderOptions?: ExternalsBuilderInitialOptions,
	lazyBuilderOptions?: LazyBuilderInitialOptions,
): Builder => {
	if (!lazyBuilderOptions?.getBuilder) {
		const esbuildBuilder = createEsbuildBuilder(esbuildBuilderOptions);
		const svelteBuilder = createSvelteBuilder(svelteBuilderOptions);
		const externalsBuilder = createExternalsBuilder(externalsBuilderOptions);
		const builders: Builder[] = [esbuildBuilder, svelteBuilder, externalsBuilder];
		lazyBuilderOptions = {
			...lazyBuilderOptions,
			getBuilder: (source, buildConfig) => {
				if (source.id === EXTERNALS_SOURCE_ID) {
					if (buildConfig.platform !== 'browser') {
						throw Error('Expected browser for externals builder.');
					}
					return externalsBuilder;
				}
				switch (source.extension) {
					case TS_EXTENSION:
						return esbuildBuilder;
					case SVELTE_EXTENSION:
						return svelteBuilder;
					default:
						return null;
				}
			},
			getBuilders: () => builders,
		};
	}

	return createLazyBuilder(lazyBuilderOptions);
};
