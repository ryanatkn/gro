import {gro_builder_noop} from './gro_builder_noop.js';
import type {BuildContext, Builder} from './builder.js';
import type {BuildConfig} from './build_config.js';
import type {SourceFile} from './source_file.js';

export interface GetBuilder {
	(source: SourceFile, build_config: BuildConfig): Builder | null;
}
export interface GetBuilders {
	(): Builder[];
}
const toGroBuilderNoop: GetBuilder = () => gro_builder_noop;
const toGroBuilderNoops: GetBuilders = () => [gro_builder_noop];

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
	const {to_builder = toGroBuilderNoop, to_builders = toGroBuilderNoops} = options;

	const build: Builder['build'] = (source, build_config, ctx) => {
		const builder = to_builder(source, build_config) || gro_builder_noop;
		return builder.build(source, build_config, ctx);
	};

	const on_remove: Builder['on_remove'] = async (
		source: SourceFile,
		build_config: BuildConfig,
		ctx: BuildContext,
	) => {
		const builder = to_builder(source, build_config) || gro_builder_noop;
		if (builder.on_remove === undefined) return;
		await builder.on_remove(source, build_config, ctx);
	};

	const init: Builder['init'] = async (ctx: BuildContext) => {
		await Promise.all(to_builders().map((builder) => builder.init?.(ctx)));
	};

	return {name: 'gro_builder_simple', build, on_remove, init};
};
