import type {Plugin} from 'rollup';
import {resolve, dirname} from 'path';
import {createFilter} from '@rollup/pluginutils';
import type {Partial_Except} from '@feltcoop/felt';
import {green} from '@feltcoop/felt/util/terminal.js';
import {print_log_label, System_Logger} from '@feltcoop/felt/util/log.js';
import {omit_undefined} from '@feltcoop/felt/util/object.js';

import type {Gro_Css_Build} from './gro_css_build.js';
import type {Filesystem} from '../fs/filesystem.js';

export interface Options {
	fs: Filesystem;
	add_css_build(build: Gro_Css_Build): boolean;
	extensions: string[]; // see comments below at `sort_index_by_id` for why this exists
	include: string | RegExp | (string | RegExp)[] | null;
	exclude: string | RegExp | (string | RegExp)[] | null;
}
export type Required_Options = 'fs' | 'add_css_build';
export type Initial_Options = Partial_Except<Options, Required_Options>;
export const init_options = (opts: Initial_Options): Options => {
	if (opts.include && !opts.extensions) {
		throw Error(`The 'extensions' option must be provided along with 'include'`);
	}
	const extensions = opts.extensions || ['.css'];
	return {
		extensions,
		include: opts.include || extensions.map((ext) => `**/*${ext}`),
		exclude: null,
		...omit_undefined(opts),
	};
};

export const name = 'plain-css';

export const rollup_plugin_plain_css = (opts: Initial_Options): Plugin => {
	const {fs, add_css_build, extensions, include, exclude} = init_options(opts);

	const log = new System_Logger(print_log_label(name, green));

	const filter = createFilter(include, exclude);

	// Rollup's `transform` hook executes in non-deterministic order,
	// so we need to preserve the css import order manually.
	// Otherwise, the cascade gets randomly shuffled!
	const sort_index_by_id = new Map<string, number>();
	let current_sort_index = 0;
	const get_sort_index = (id: string): number => {
		// Plain css is always appended to avoid messing up sourcemaps.
		// Any css id that isn't plain css won't be cached, returning -1 here.
		// See `sort_index_by_id` above for why this exists.
		const index = sort_index_by_id.get(id);
		if (index === undefined) return -1;
		return index;
	};

	return {
		name,
		// see comments above for what this is doing
		async resolveId(importee, importer) {
			// This is a hack that ignores `include`, but the whole thing is a hack.
			// See the above comments at `sort_index_by_id` for the explanation.
			if (!extensions.some((e) => importee.endsWith(e)) || !importer) return null;
			// Originally this used `this.resolve`,
			// but it goes into an infinite loop when an importee doesn't exist,
			// despite using `{skipSelf: true}`. So we manually resolve the id.
			const resolved_id = resolve(dirname(importer), importee);
			if (sort_index_by_id.has(resolved_id)) return resolved_id; // this doesn't account for import order changing while in watch mode
			if (!(await fs.exists(resolved_id))) return null; // allow node imports like `normalize.css`
			sort_index_by_id.set(resolved_id, current_sort_index);
			current_sort_index++;
			return resolved_id;
		},
		async transform(code, id) {
			if (!filter(id)) return;
			log.info(`transform id`, id);

			const updated_cache = add_css_build({
				id,
				source_id: id,
				sort_index: get_sort_index(id),
				code,
				map: undefined,
			});
			if (!updated_cache) log.error('Unexpected css cache update failure');

			return '';
		},
	};
};
