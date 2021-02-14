import {SVELTE_EXTENSION, TS_EXTENSION} from '../paths.js';
import {
	CompilationSource,
	Builder,
	createBuilder,
	InitialOptions as BuilderInitialOptions,
} from './builder.js';
import {createSwcBuilder, InitialOptions as SwcBuilderInitialOptions} from './swcBuilder.js';
import {
	createSvelteBuilder,
	InitialOptions as SvelteBuilderInitialOptions,
} from './svelteBuilder.js';
import {
	createExternalsBuilder,
	InitialOptions as ExternalsBuilderInitialOptions,
} from './externalsBuilder.js';

export const createDefaultBuilder = (
	swcBuilderOptions?: SwcBuilderInitialOptions,
	svelteBuilderOptions?: SvelteBuilderInitialOptions,
	externalsBuilderOptions?: ExternalsBuilderInitialOptions,
	builderOptions?: BuilderInitialOptions,
): Builder => {
	const swcBuilder = createSwcBuilder(swcBuilderOptions);
	const svelteBuilder = createSvelteBuilder(svelteBuilderOptions);
	const externalsBuilder = createExternalsBuilder(externalsBuilderOptions);

	if (!builderOptions?.getBuilder) {
		builderOptions = {
			...builderOptions,
			getBuilder: (source: CompilationSource) => {
				if (source.sourceType === 'externals') {
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

	return createBuilder(builderOptions);
};
