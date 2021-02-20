import {pathExists, readJson} from '../fs/nodeFs.js';
import {ImportMap} from 'esinstall';

import {paths, SVELTE_EXTENSION, TS_EXTENSION} from '../paths.js';
import {
	BuildSource,
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

export const createDefaultBuilder = async (
	swcBuilderOptions?: SwcBuilderInitialOptions,
	svelteBuilderOptions?: SvelteBuilderInitialOptions,
	externalsBuilderOptions?: ExternalsBuilderInitialOptions,
	builderOptions?: BuilderInitialOptions,
): Promise<Builder> => {
	const swcBuilder = createSwcBuilder(swcBuilderOptions);
	const svelteBuilder = createSvelteBuilder(svelteBuilderOptions);

	const importMapPath = `${paths.externals}/import-map.json`; // TODO where should this go?
	const importMap: ImportMap | undefined =
		externalsBuilderOptions?.importMap || (await pathExists(importMapPath))
			? await readJson(importMapPath)
			: undefined;
	externalsBuilderOptions = {...externalsBuilderOptions, importMap};
	const externalsBuilder = createExternalsBuilder(externalsBuilderOptions);

	if (!builderOptions?.getBuilder) {
		builderOptions = {
			...builderOptions,
			getBuilder: (source: BuildSource) => {
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
