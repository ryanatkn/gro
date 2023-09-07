import type {Builder} from './builder.js';
import {JSON_EXTENSION, JS_EXTENSION, TS_EXTENSION} from '../path/paths.js';
import {gro_builder_simple, type Options as SimpleBuilderOptions} from './gro_builder_simple.js';
import {gro_builder_esbuild, type Options as EsbuildBuilderOptions} from './gro_builder_esbuild.js';
import {gro_builder_json, type Options as JsonBuilderOptions} from './gro_builder_json.js';

export interface Options {
	esbuildBuilderOptions?: EsbuildBuilderOptions;
	jsonBuilderOptions?: JsonBuilderOptions;
	simpleBuilderOptions?: SimpleBuilderOptions;
}

export const gro_builder_default = (options: Options = {}): Builder => {
	const {esbuildBuilderOptions, jsonBuilderOptions, simpleBuilderOptions} = options;
	let finalSimpleBuilderOptions = simpleBuilderOptions;
	if (!simpleBuilderOptions?.to_builder) {
		const esbuildBuilder = gro_builder_esbuild(esbuildBuilderOptions);
		const jsonBuilder = gro_builder_json(jsonBuilderOptions);
		const builders: Builder[] = [esbuildBuilder as Builder]; // TODO why the typecast?
		finalSimpleBuilderOptions = {
			...simpleBuilderOptions,
			to_builder: (source) => {
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
			to_builders: () => builders,
		};
	}

	return {
		...gro_builder_simple(finalSimpleBuilderOptions),
		name: 'gro_builder_default',
	};
};
