import type {Builder} from './builder.js';
import {JSON_EXTENSION, JS_EXTENSION, SVELTE_EXTENSION, TS_EXTENSION} from '../path/paths.js';
import {groBuilderSimple, type Options as SimpleBuilderOptions} from './groBuilderSimple.js';
import {groBuilderEsbuild, type Options as EsbuildBuilderOptions} from './groBuilderEsbuild.js';
import {groBuilderSvelte, type Options as SvelteBuilderOptions} from './groBuilderSvelte.js';
import {groBuilderJson, type Options as JsonBuilderOptions} from './groBuilderJson.js';

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
		const builders: Builder[] = [esbuildBuilder as Builder, svelteBuilder as Builder]; // TODO why the typecast?
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
						return null as any; // TODO why the typecast? see above too
				}
			},
			toBuilders: () => builders,
		};
	}

	return {
		...groBuilderSimple(finalSimpleBuilderOptions),
		name: '@feltjs/groBuilderDefault',
	};
};
