import {omitUndefined} from '@feltcoop/felt/utils/object.js';

import {noopBuilder} from './builder.js';
import type {BuildContext, Builder, BuildSource} from './builder.js';
import type {Build_Config} from '../build/build_config.js';

export interface GetBuilder {
	(source: BuildSource, build_config: Build_Config): Builder | null;
}
export interface GetBuilders {
	(): Builder[];
}
const getNoopBuilder: GetBuilder = () => noopBuilder;
const getNoopBuilders: GetBuilders = () => noopBuilders;
const noopBuilders: Builder[] = [noopBuilder];

export interface Options {
	getBuilder: GetBuilder;
	getBuilders: GetBuilders;
}
export type InitialOptions = Partial<Options>;
export const initOptions = (opts: InitialOptions): Options => {
	return {
		getBuilder: getNoopBuilder,
		getBuilders: getNoopBuilders,
		...omitUndefined(opts),
	};
};

// This `Lazy` builder proxies normal builder function calls,
// using a builder obtained from `getBuilder`,
// allowing user code to defer to the decision to the moment of action at runtime,
// which usually includes more useful contextual information.
// Because it proxies all calls, it implements all of `Builder`, hence `Required`.
export const createLazyBuilder = (opts: InitialOptions = {}): Required<Builder> => {
	const {getBuilder, getBuilders} = initOptions(opts);

	const build: Builder['build'] = (source, build_config, ctx) => {
		const builder = getBuilder(source, build_config) || noopBuilder;
		return builder.build(source, build_config, ctx);
	};

	const onRemove: Builder['onRemove'] = async (
		source: BuildSource,
		build_config: Build_Config,
		ctx: BuildContext,
	) => {
		const builder = getBuilder(source, build_config) || noopBuilder;
		if (builder.onRemove === undefined) return;
		await builder.onRemove(source, build_config, ctx);
	};

	const init: Builder['init'] = async (ctx: BuildContext) => {
		for (const builder of getBuilders()) {
			if (builder.init === undefined) continue;
			await builder.init(ctx);
		}
	};

	return {name: '@feltcoop/gro-builder-lazy', build, onRemove, init};
};
