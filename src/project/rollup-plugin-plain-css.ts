import {Plugin} from 'rollup';
import {resolve, dirname} from 'path';
import {existsSync} from 'fs';
import rollupPluginutils from '@rollup/pluginutils';
const {createFilter} = rollupPluginutils; // TODO esm

import {green} from '../colors/terminal.js';
import {SystemLogger} from '../utils/log.js';
import {GroCssBuild} from './types.js';
import {hasExt} from '../utils/path.js';
import {omitUndefined} from '../utils/object.js';

export interface Options {
	addCssBuild(build: GroCssBuild): boolean;
	exts: string[]; // see comments below at `indexById` for why this exists
	include: string | RegExp | (string | RegExp)[] | null;
	exclude: string | RegExp | (string | RegExp)[] | null;
}
export type RequiredOptions = 'addCssBuild';
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => {
	if (opts.include && !opts.exts) {
		throw Error(`The 'exts' option must be provided along with 'include'`);
	}
	const exts = opts.exts || ['.css'];
	return {
		exts,
		include: opts.include || exts.map((ext) => `**/*${ext}`),
		exclude: null,
		...omitUndefined(opts),
	};
};

export const name = 'plain-css';

export const plainCssPlugin = (opts: InitialOptions): Plugin => {
	const {addCssBuild, exts, include, exclude} = initOptions(opts);

	const log = new SystemLogger([green(`[${name}]`)]);

	const filter = createFilter(include, exclude);

	// Rollup's `transform` hook executes in non-deterministic order,
	// so we need to preserve the css import order manually.
	// Otherwise, the cascade gets randomly shuffled!
	const sortIndexById = new Map<string, number>();
	let currentSortIndex = 0;
	const getSortIndex = (id: string): number => {
		// Plain css is always appended to avoid messing up sourcemaps.
		// Any css id that isn't plain css won't be cached, returning -1 here.
		// See `indexById` above for why this exists.
		const index = sortIndexById.get(id);
		if (index === undefined) return -1;
		return index;
	};

	return {
		name,
		// see comments above for what this is doing
		resolveId(importee, importer) {
			// This is a hack that ignores `include`, but the whole thing is a hack.
			// See the above comments at `indexById` for the explanation.
			if (!hasExt(importee, exts) || !importer) return null;
			// Originally this used `this.resolve`,
			// but it goes into an infinite loop when an importee doesn't exist,
			// despite using `{skipSelf: true}`. So we manually resolve the id.
			const resolvedId = resolve(dirname(importer), importee);
			if (sortIndexById.has(resolvedId)) return resolvedId; // this doesn't account for import order changing while in watch mode
			if (!existsSync(resolvedId)) return null; // allow node imports like `normalize.css`
			sortIndexById.set(resolvedId, currentSortIndex);
			currentSortIndex++;
			return resolvedId;
		},
		async transform(code, id) {
			if (!filter(id)) return;
			log.info(`transform id`, id);

			const updatedCache = addCssBuild({
				id,
				sourceId: id,
				sortIndex: getSortIndex(id),
				code,
				map: undefined,
			});
			if (!updatedCache) log.error('Unexpected css cache update failure');

			return '';
		},
	};
};
