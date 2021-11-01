import type {Builder} from 'src/build/builder.js';
import {JSON_EXTENSION, JS_EXTENSION, SVELTE_EXTENSION, TS_EXTENSION} from '../paths.js';
import {groBuilderSimple} from './groBuilderSimple.js';
import type {Options as SimpleBuilderOptions} from 'src/build/groBuilderSimple.js';
import {groBuilderEsbuild} from './groBuilderEsbuild.js';
import type {Options as EsbuildBuilderOptions} from 'src/build/groBuilderEsbuild.js';
import {groBuilderSvelte} from './groBuilderSvelte.js';
import type {Options as SvelteBuilderOptions} from 'src/build/groBuilderSvelte.js';
import {groBuilderJson} from './groBuilderJson.js';
import type {Options as JsonBuilderOptions} from 'src/build/groBuilderJson.js';

export interface Options {
	esbuildBuilderOptions?: EsbuildBuilderOptions;
	svelteBuilderOptions?: SvelteBuilderOptions;
	jsonBuilderOptions?: JsonBuilderOptions;
	simpleBuilderOptions?: SimpleBuilderOptions;
}

export const groBuilderDefault = (options: Options = {}): Builder => {
	const {esbuildBuilderOptions, svelteBuilderOptions, jsonBuilderOptions, simpleBuilderOptions} =
		options;
	let finalSimpleBuilderOptions = simpleBuilderOptions;
	if (!simpleBuilderOptions?.toBuilder) {
		const esbuildBuilder = groBuilderEsbuild(esbuildBuilderOptions);
		const svelteBuilder = groBuilderSvelte(svelteBuilderOptions);
		const jsonBuilder = groBuilderJson(jsonBuilderOptions);
		const builders: Builder[] = [esbuildBuilder, svelteBuilder];
		finalSimpleBuilderOptions = {
			...simpleBuilderOptions,
			toBuilder: (source) => {
				switch (source.extension) {
					case TS_EXTENSION:
					case JS_EXTENSION:
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
