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
		// Create a Go-compatible regexp
		const filter = new RegExp(`^(?:${Object.keys(aliases).map(escape_regexp).join('|')})`);
		build.onResolve({filter}, async (args) => {
			const {path, ...rest} = args;
			// Find which alias prefix matches
			const prefix = Object.keys(aliases).find((key) => path.startsWith(key));
			if (!prefix) return null;
			return build.resolve(join(dir, aliases[prefix] + path.substring(prefix.length)), rest);
		});
	},
});
