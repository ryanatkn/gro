import {omit_undefined} from '@feltcoop/felt/util/object.js';

import {gro_builder_noop} from './gro_builder_noop.js';
import type {Build_Context, Builder, Build_Source} from 'src/build/builder.js';
import type {Build_Config} from 'src/build/build_config.js';

export interface Get_Builder {
	(source: Build_Source, build_config: Build_Config): Builder | null;
}
export interface Get_Builders {
	(): Builder[];
}
const get_gro_builder_noop: Get_Builder = () => gro_builder_noop;
const get_gro_builder_noops: Get_Builders = () => gro_builder_noops;
const gro_builder_noops: Builder[] = [gro_builder_noop];

export interface Options {
	get_builder: Get_Builder;
	get_builders: Get_Builders;
}
export type Initial_Options = Partial<Options>;
export const init_options = (opts: Initial_Options): Options => {
	return {
		get_builder: get_gro_builder_noop,
		get_builders: get_gro_builder_noops,
		...omit_undefined(opts),
	};
};

// This `simple` builder proxies normal builder function calls,
// using a builder obtained from `get_builder`,
// allowing user code to defer to the decision to the moment of action at runtime,
// which usually includes more useful contextual information.
// Because it proxies all calls, it implements all of `Builder`, hence `Required`.
export const gro_builder_simple = (opts: Initial_Options = {}): Required<Builder> => {
	const {get_builder, get_builders} = init_options(opts);

	const build: Builder['build'] = (source, build_config, ctx) => {
		const builder = get_builder(source, build_config) || gro_builder_noop;
		return builder.build(source, build_config, ctx);
	};

	const on_remove: Builder['on_remove'] = async (
		source: Build_Source,
		build_config: Build_Config,
		ctx: Build_Context,
	) => {
		const builder = get_builder(source, build_config) || gro_builder_noop;
		if (builder.on_remove === undefined) return;
		await builder.on_remove(source, build_config, ctx);
	};

	const init: Builder['init'] = async (ctx: Build_Context) => {
		for (const builder of get_builders()) {
			if (builder.init === undefined) continue;
			await builder.init(ctx);
		}
	};

	return {name: '@feltcoop/gro_builder_simple', build, on_remove, init};
};
