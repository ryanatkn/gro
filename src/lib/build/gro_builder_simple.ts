import {gro_builder_noop} from './gro_builder_noop.js';
import type {BuildContext, Builder} from './builder.js';
import type {BuildConfig} from './build_config.js';
import type {SourceFile} from './sourceFile.js';

export interface GetBuilder {
	(source: SourceFile, build_config: BuildConfig): Builder | null;
}
export interface GetBuilders {
	(): Builder[];
}
const toGroBuilderNoop: GetBuilder = () => gro_builder_noop;
const toGroBuilderNoops: GetBuilders = () => [gro_builder_noop];

export interface Options {
	toBuilder?: GetBuilder;
	toBuilders?: GetBuilders;
}

// This `simple` builder proxies normal builder function calls,
// using a builder obtained from `toBuilder`,
// allowing user code to defer to the decision to the moment of action at runtime,
// which usually includes more useful contextual information.
// Because it proxies all calls, it implements all of `Builder`, hence `Required`.
export const gro_builder_simple = (options: Options = {}): Required<Builder> => {
	const {toBuilder = toGroBuilderNoop, toBuilders = toGroBuilderNoops} = options;

	const build: Builder['build'] = (source, build_config, ctx) => {
		const builder = toBuilder(source, build_config) || gro_builder_noop;
		return builder.build(source, build_config, ctx);
	};

	const on_remove: Builder['on_remove'] = async (
		source: SourceFile,
		build_config: BuildConfig,
		ctx: BuildContext,
	) => {
		const builder = toBuilder(source, build_config) || gro_builder_noop;
		if (builder.on_remove === undefined) return;
		await builder.on_remove(source, build_config, ctx);
	};

	const init: Builder['init'] = async (ctx: BuildContext) => {
		await Promise.all(toBuilders().map((builder) => builder.init?.(ctx)));
	};

	return {name: 'gro_builder_simple', build, on_remove, init};
};
