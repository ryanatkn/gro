import type {Builder} from './builder.js';
import {JSON_EXTENSION, JS_EXTENSION, TS_EXTENSION} from '../path/paths.js';
import {groBuilderSimple, type Options as SimpleBuilderOptions} from './groBuilderSimple.js';
import {groBuilderEsbuild, type Options as EsbuildBuilderOptions} from './groBuilderEsbuild.js';
import {groBuilderJson, type Options as JsonBuilderOptions} from './groBuilderJson.js';

export interface Options {
	esbuildBuilderOptions?: EsbuildBuilderOptions;
	jsonBuilderOptions?: JsonBuilderOptions;
	simpleBuilderOptions?: SimpleBuilderOptions;
}

export const groBuilderDefault = (options: Options = {}): Builder => {
	const {esbuildBuilderOptions, jsonBuilderOptions, simpleBuilderOptions} = options;
	let finalSimpleBuilderOptions = simpleBuilderOptions;
	if (!simpleBuilderOptions?.toBuilder) {
		const esbuildBuilder = groBuilderEsbuild(esbuildBuilderOptions);
		const jsonBuilder = groBuilderJson(jsonBuilderOptions);
		const builders: Builder[] = [esbuildBuilder as Builder]; // TODO why the typecast?
		finalSimpleBuilderOptions = {
			...simpleBuilderOptions,
			toBuilder: (source) => {
				switch (source.extension) {
					case TS_EXTENSION:
					case JS_EXTENSION:
						return esbuildBuilder;
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
