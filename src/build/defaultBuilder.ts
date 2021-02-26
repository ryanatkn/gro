import {SVELTE_EXTENSION, TS_EXTENSION} from '../paths.js';
import {BuildSource, Builder} from './builder.js';
import {createLazyBuilder, InitialOptions as LazyBuilderInitialOptions} from './lazyBuilder.js';
import {createSwcBuilder, InitialOptions as SwcBuilderInitialOptions} from './swcBuilder.js';
import {
	createSvelteBuilder,
	InitialOptions as SvelteBuilderInitialOptions,
} from './svelteBuilder.js';
import {
	createExternalsBuilder,
	InitialOptions as ExternalsBuilderInitialOptions,
} from './externalsBuilder.js';

export const createDefaultBuilder = async (
	swcBuilderOptions?: SwcBuilderInitialOptions,
	svelteBuilderOptions?: SvelteBuilderInitialOptions,
	externalsBuilderOptions?: ExternalsBuilderInitialOptions,
	lazyBuilderOptions?: LazyBuilderInitialOptions,
): Promise<Builder> => {
	const swcBuilder = createSwcBuilder(swcBuilderOptions);
	const svelteBuilder = createSvelteBuilder(svelteBuilderOptions);
	const externalsBuilder = createExternalsBuilder(externalsBuilderOptions);

	if (!lazyBuilderOptions?.getBuilder) {
		lazyBuilderOptions = {
			...lazyBuilderOptions,
			getBuilder: (source: BuildSource) => {
				if (source.external) {
					return externalsBuilder;
				}
				switch (source.extension) {
					case TS_EXTENSION:
						return swcBuilder;
					case SVELTE_EXTENSION:
						return svelteBuilder;
					default:
						return null;
				}
			},
		};
	}

	return createLazyBuilder(lazyBuilderOptions);
};
