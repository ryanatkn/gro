import type * as esbuild from 'esbuild';
import {readFile} from 'node:fs/promises';
import {dirname} from 'node:path';

import {resolve_specifier} from './resolve_specifier.js';

/**
 * Adds support for imports to both `.ts` and `.js`,
 * as well as imports without extensions that resolve to `.js` or `.ts`.
 * Prefers `.ts` over any `.js`, and falls back to `.ts` if no file is found.
 */
export const esbuild_plugin_sveltekit_local_imports = (): esbuild.Plugin => ({
	name: 'sveltekit_local_imports',
	setup: (build) => {
		build.onResolve({filter: /^(\/|\.)/u}, async (args) => {
			const {path, importer} = args;
			if (!importer) return {path};
			const {source_id, namespace} = await resolve_specifier(path, dirname(importer));
			return namespace ? {path: source_id, namespace} : {path};
		});
		build.onLoad({filter: /.*/u, namespace: 'sveltekit_local_imports_ts'}, async ({path}) => ({
			contents: await readFile(path),
			loader: 'ts',
		}));
		build.onLoad({filter: /.*/u, namespace: 'sveltekit_local_imports_js'}, async ({path}) => ({
			contents: await readFile(path),
			loader: 'js',
		}));
	},
});
