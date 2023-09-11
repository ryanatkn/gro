import type * as esbuild from 'esbuild';
import {escapeRegexp} from '@feltjs/util/regexp.js';

export interface Options {
	dir: string;
	alias?: Record<string, string>;
}

export const esbuild_plugin_sveltekit_shim_alias = ({dir, alias}: Options): esbuild.Plugin => ({
	name: 'sveltekit_shim_alias',
	setup: (build) => {
		const aliases: Record<string, string> = {$lib: 'src/lib', ...alias};
		const alias_prefixes = Object.keys(aliases).map((a) => escapeRegexp(a));
		const filter = new RegExp('^(' + alias_prefixes.join('|') + ')', 'u');
		build.onResolve({filter}, async (args) => {
			const {path, ...rest} = args;
			const prefix = filter.exec(path)![1];
			return build.resolve(dir + aliases[prefix] + path.substring(prefix.length), rest);
		});
	},
});
