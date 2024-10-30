import type * as esbuild from 'esbuild';
import {escape_regexp} from '@ryanatkn/belt/regexp.js';
import {join} from 'node:path';

export interface Esbuild_Plugin_Sveltekit_Shim_Alias_Options {
	dir?: string;
	alias?: Record<string, string>;
}

export const esbuild_plugin_sveltekit_shim_alias = ({
	dir = process.cwd(),
	alias,
}: Esbuild_Plugin_Sveltekit_Shim_Alias_Options): esbuild.Plugin => ({
	name: 'sveltekit_shim_alias',
	setup: (build) => {
		const aliases: Record<string, string> = {$lib: 'src/lib', ...alias};
		const alias_regexp_prefixes = Object.keys(aliases).map((a) => escape_regexp(a));
		const filter = new RegExp('^(' + alias_regexp_prefixes.join('|') + ')', 'u');
		build.onResolve({filter}, async (args) => {
			const {path, ...rest} = args;
			const prefix = filter.exec(path)![1];
			return build.resolve(join(dir, aliases[prefix] + path.substring(prefix.length)), rest);
		});
	},
});
