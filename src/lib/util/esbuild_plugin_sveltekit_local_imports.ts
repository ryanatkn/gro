import type * as esbuild from 'esbuild';
import {yellow, blue, magenta} from 'kleur/colors';
import {readFile} from 'node:fs/promises';
import {dirname} from 'node:path';

import {resolve_specifier} from './resolve_specifier.js';

export const esbuild_plugin_sveltekit_local_imports = (): esbuild.Plugin => ({
	name: 'sveltekit_local_imports',
	setup: (build) => {
		build.onResolve({filter: /^(\/|\.)/u}, async (args) => {
			const {path, importer, resolveDir} = args;
			console.log(
				blue('[sveltekit_imports] ENTER'),
				'\nimporting ' + yellow(path),
				'\nfrom ' + yellow(importer),
			);
			if (!importer) {
				console.log(blue('[sveltekit_imports] EXIT EARLY without importer'), yellow(path));
				return {
					path,
					namespace: 'sveltekit_local_imports_entrypoint',
				};
			}

			const parsed = await resolve_specifier(path, importer, resolveDir);
			console.log(blue('[sveltekit_imports] EXIT'), yellow(parsed.specifier), parsed);
			const {specifier, source_id, namespace} = parsed;

			return namespace ? {path: specifier, namespace, pluginData: {source_id}} : {path};
		});
		// TODO BLOCK can we remove this?
		build.onLoad(
			{filter: /.*/u, namespace: 'sveltekit_local_imports_entrypoint'},
			async ({path}) => {
				const resolveDir = dirname(path);
				console.log(magenta(`>>>>LOAD entrypoint path`), path);
				return {contents: await readFile(path), loader: 'ts', resolveDir};
			},
		);
		build.onLoad(
			{filter: /.*/u, namespace: 'sveltekit_local_imports_ts'},
			async ({path, pluginData: {source_id}}) => {
				const resolveDir = dirname(source_id);
				console.log(magenta(`>>>>LOAD TS path, pluginData`), path, source_id);
				return {contents: await readFile(source_id), loader: 'ts', resolveDir};
			},
		);
		build.onLoad(
			{filter: /.*/u, namespace: 'sveltekit_local_imports_js'},
			async ({path, pluginData: {source_id}}) => {
				const resolveDir = dirname(source_id);
				console.log(magenta(`>>>>LOAD JS path, pluginData`), path, source_id);
				return {contents: await readFile(source_id), loader: 'js', resolveDir};
			},
		);
	},
});
