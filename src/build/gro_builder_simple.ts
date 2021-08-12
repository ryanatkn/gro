import {gro_builder_noop} from './gro_builder_noop.js';
import type {BuildContext, Builder, BuildSource} from 'src/build/builder.js';
import type {BuildConfig} from 'src/build/build_config.js';

export interface GetBuilder {
	(source: BuildSource, build_config: BuildConfig): Builder | null;
}
export interface GetBuilders {
	(): Builder[];
}
const to_gro_builder_noop: GetBuilder = () => gro_builder_noop;
const to_gro_builder_noops: GetBuilders = () => [gro_builder_noop];

export interface Options {
	to_builder?: GetBuilder;
	to_builders?: GetBuilders;
}

// This `simple` builder proxies normal builder function calls,
// using a builder obtained from `to_builder`,
// allowing user code to defer to the decision to the moment of action at runtime,
// which usually includes more useful contextual information.
// Because it proxies all calls, it implements all of `Builder`, hence `Required`.
export const gro_builder_simple = (options: Options = {}): Required<Builder> => {
	const {to_builder = to_gro_builder_noop, to_builders = to_gro_builder_noops} = options;

	const build: Builder['build'] = (source, build_config, ctx) => {
		const builder = to_builder(source, build_config) || gro_builder_noop;
		return builder.build(source, build_config, ctx);
	};

	const on_remove: Builder['on_remove'] = async (
		source: BuildSource,
		build_config: BuildConfig,
		ctx: BuildContext,
	) => {
		const builder = to_builder(source, build_config) || gro_builder_noop;
		if (builder.on_remove === undefined) return;
		await builder.on_remove(source, build_config, ctx);
	};

	const init: Builder['init'] = async (ctx: BuildContext) => {
		for (const builder of to_builders()) {
			if (builder.init === undefined) continue;
			await builder.init(ctx);
		}
	};

	return {name: '@feltcoop/gro_builder_simple', build, on_remove, init};
};
