import {green} from 'kleur';

import {LogLevel, logger, fmtVal} from '../utils/logUtils';
import {toRootPath} from '../paths';

export interface CssBuild {
	id: string;
	code: string;
}

export type CssBundle<T extends CssBuild = CssBuild> = {
	bundleName: string;
	buildsById: Map<string, T>;
	changedIds: Set<string>;
};

export interface CssCache<T extends CssBuild = CssBuild> {
	getCssBundles(): Map<string, CssBundle<T>>;
	getCssBuild(bundleName: string, id: string): T | undefined;
	addCssBuild(bundleName: string, build: T): boolean;
}

export interface Options {
	logLevel: LogLevel;
}
export type RequiredOptions = never;
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => ({
	logLevel: LogLevel.Info,
	...opts,
});

export const createCssCache = <T extends CssBuild = CssBuild>(
	opts: InitialOptions = {},
): CssCache<T> => {
	const {logLevel} = initOptions(opts);

	const {info} = logger(logLevel, [green('[cssCache]')]);

	// `bundles` key is an output bundle file name
	const bundles = new Map<string, CssBundle<T>>();

	return {
		getCssBundles: () => bundles,
		getCssBuild: (bundleName, id) => {
			const bundle = bundles.get(bundleName);
			if (!bundle) return undefined;
			return bundle.buildsById.get(id);
		},
		addCssBuild: (bundleName, build): boolean => {
			const {id} = build;
			let bundle = bundles.get(bundleName);
			if (bundle) {
				const cachedBuild = bundle.buildsById.get(id);
				if (build.code === (cachedBuild && cachedBuild.code)) {
					// build didn't change
					return false;
				}
			} else {
				bundle = {bundleName, buildsById: new Map(), changedIds: new Set()};
				bundles.set(bundleName, bundle);
			}

			info(fmtVal('caching', toRootPath(id)), fmtVal('bundle', bundleName));
			bundle.buildsById.set(id, build);
			bundle.changedIds.add(id);

			// build changed
			return true;
		},
	};
};
