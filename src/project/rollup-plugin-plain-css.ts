import type {Plugin} from 'rollup';
import {resolve, dirname} from 'path';
import {createFilter} from '@rollup/pluginutils';

import {green} from '../utils/terminal.js';
import {printLogLabel, SystemLogger} from '../utils/log.js';
import type {GroCssBuild} from './types.js';
import {omitUndefined} from '../utils/object.js';
import type {PartialExcept} from '../index.js';
import {pathExists} from '../fs/node.js';

export interface Options {
	addCssBuild(build: GroCssBuild): boolean;
	extensions: string[]; // see comments below at `sortIndexById` for why this exists
	include: string | RegExp | (string | RegExp)[] | null;
	exclude: string | RegExp | (string | RegExp)[] | null;
}
export type RequiredOptions = 'addCssBuild';
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => {
	if (opts.include && !opts.extensions) {
		throw Error(`The 'extensions' option must be provided along with 'include'`);
	}
	const extensions = opts.extensions || ['.css'];
	return {
		extensions,
		include: opts.include || extensions.map((ext) => `**/*${ext}`),
		exclude: null,
		...omitUndefined(opts),
	};
};

export const name = 'plain-css';

export const plainCssPlugin = (opts: InitialOptions): Plugin => {
	const {addCssBuild, extensions, include, exclude} = initOptions(opts);

	const log = new SystemLogger(printLogLabel(name, green));

	const filter = createFilter(include, exclude);

	// Rollup's `transform` hook executes in non-deterministic order,
	// so we need to preserve the css import order manually.
	// Otherwise, the cascade gets randomly shuffled!
	const sortIndexById = new Map<string, number>();
	let currentSortIndex = 0;
	const getSortIndex = (id: string): number => {
		// Plain css is always appended to avoid messing up sourcemaps.
		// Any css id that isn't plain css won't be cached, returning -1 here.
		// See `sortIndexById` above for why this exists.
		const index = sortIndexById.get(id);
		if (index === undefined) return -1;
		return index;
	};

	return {
		name,
		// see comments above for what this is doing
		async resolveId(importee, importer) {
			// This is a hack that ignores `include`, but the whole thing is a hack.
			// See the above comments at `sortIndexById` for the explanation.
			if (!extensions.some((e) => importee.endsWith(e)) || !importer) return null;
			// Originally this used `this.resolve`,
			// but it goes into an infinite loop when an importee doesn't exist,
			// despite using `{skipSelf: true}`. So we manually resolve the id.
			const resolvedId = resolve(dirname(importer), importee);
			if (sortIndexById.has(resolvedId)) return resolvedId; // this doesn't account for import order changing while in watch mode
			if (!(await pathExists(resolvedId))) return null; // allow node imports like `normalize.css`
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
