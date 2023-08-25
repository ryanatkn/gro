import {groBuilderNoop} from './groBuilderNoop.js';
import type {BuildContext, Builder, BuildSource} from './builder.js';
import type {BuildConfig} from './buildConfig.js';

export interface GetBuilder {
	(source: BuildSource, buildConfig: BuildConfig): Builder | null;
}
export interface GetBuilders {
	(): Builder[];
}
const toGroBuilderNoop: GetBuilder = () => groBuilderNoop;
const toGroBuilderNoops: GetBuilders = () => [groBuilderNoop];

export interface Options {
	toBuilder?: GetBuilder;
	toBuilders?: GetBuilders;
}

// This `simple` builder proxies normal builder function calls,
// using a builder obtained from `toBuilder`,
// allowing user code to defer to the decision to the moment of action at runtime,
// which usually includes more useful contextual information.
// Because it proxies all calls, it implements all of `Builder`, hence `Required`.
export const groBuilderSimple = (options: Options = {}): Required<Builder> => {
	const {toBuilder = toGroBuilderNoop, toBuilders = toGroBuilderNoops} = options;

	const build: Builder['build'] = (source, buildConfig, ctx) => {
		const builder = toBuilder(source, buildConfig) || groBuilderNoop;
		return builder.build(source, buildConfig, ctx);
	};

	const onRemove: Builder['onRemove'] = async (
		source: BuildSource,
		buildConfig: BuildConfig,
		ctx: BuildContext,
	) => {
		const builder = toBuilder(source, buildConfig) || groBuilderNoop;
		if (builder.onRemove === undefined) return;
		await builder.onRemove(source, buildConfig, ctx);
	};

	const init: Builder['init'] = async (ctx: BuildContext) => {
		await Promise.all(toBuilders().map((builder) => builder.init?.(ctx)));
	};

	return {name: '@feltjs/groBuilderSimple', build, onRemove, init};
};
