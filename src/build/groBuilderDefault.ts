import type {Builder} from 'src/build/builder.js';
import {EXTERNALS_SOURCE_ID} from './groBuilderExternalsUtils.js';
import {JSON_EXTENSION, SVELTE_EXTENSION, TS_EXTENSION} from '../paths.js';
import {groBuilderSimple} from './groBuilderSimple.js';
import type {Options as SimpleBuilderOptions} from 'src/build/groBuilderSimple.js';
import {groBuilderEsbuild} from './groBuilderEsbuild.js';
import type {Options as EsbuildBuilderOptions} from 'src/build/groBuilderEsbuild.js';
import {groBuilderSvelte} from './groBuilderSvelte.js';
import type {Options as SvelteBuilderOptions} from 'src/build/groBuilderSvelte.js';
import {groBuilderJson} from './groBuilderJson.js';
import type {Options as JsonBuilderOptions} from 'src/build/groBuilderJson.js';
import {groBuilderExternals} from './groBuilderExternals.js';
import type {Options as ExternalsBuilderOptions} from 'src/build/groBuilderExternals.js';

export interface Options {
	esbuildBuilderOptions?: EsbuildBuilderOptions;
	svelteBuilderOptions?: SvelteBuilderOptions;
	jsonBuilderOptions?: JsonBuilderOptions;
	externalsBuilderOptions?: ExternalsBuilderOptions;
	simpleBuilderOptions?: SimpleBuilderOptions;
}

export const groBuilderDefault = (options: Options = {}): Builder => {
	const {
		esbuildBuilderOptions,
		svelteBuilderOptions,
		jsonBuilderOptions,
		externalsBuilderOptions,
		simpleBuilderOptions,
	} = options;
	let finalSimpleBuilderOptions = simpleBuilderOptions;
	if (!simpleBuilderOptions?.toBuilder) {
		const esbuildBuilder = groBuilderEsbuild(esbuildBuilderOptions);
		const svelteBuilder = groBuilderSvelte(svelteBuilderOptions);
		const jsonBuilder = groBuilderJson(jsonBuilderOptions);
		const externalsBuilder = groBuilderExternals(externalsBuilderOptions);
		const builders: Builder[] = [esbuildBuilder, svelteBuilder, externalsBuilder];
		finalSimpleBuilderOptions = {
			...simpleBuilderOptions,
			toBuilder: (source, buildConfig) => {
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
					case JSON_EXTENSION:
						return jsonBuilder;
					default:
						return null;
				}
			},
			toBuilders: () => builders,
		};
	}

	return {
		...groBuilderSimple(finalSimpleBuilderOptions),
		name: '@feltcoop/groBuilderDefault',
	};
};
