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
			// console.log(
			// 	blue('[sveltekit_imports] ENTER'),
			// 	'\nimporting ' + yellow(path),
			// 	'\nfrom ' + yellow(importer),
			// 	'\nwith resolveDir ' + yellow(resolveDir),
			// );
			if (!importer) {
				console.log(blue('[sveltekit_imports] EXIT EARLY without importer'), yellow(path));
				return {
					path,
					namespace: 'sveltekit_local_imports_entrypoint',
				};
			}

			const {specifier, source_id, namespace} = await resolve_specifier(path, importer, resolveDir);
			if (specifier.includes('src/') || source_id.includes('vocab/vocab/'))
				console.log(
					blue('[sveltekit_imports] EXIT'),
					'\nimporting path  ' + yellow(path),
					'\nfrom importer   ' + yellow(importer),
					'\nwith resolveDir ' + yellow(resolveDir),
					'\nspecifier       ' + yellow(specifier),
					'\nsource_id       ' + source_id,
					'\nnamespace       ' + namespace,
				);

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
				console.log(magenta(`>>>>LOAD TS path, pluginData`), {path, source_id, resolveDir});
				return {contents: await readFile(source_id), loader: 'ts', resolveDir};
			},
		);
		build.onLoad(
			{filter: /.*/u, namespace: 'sveltekit_local_imports_js'},
			async ({path, pluginData: {source_id}}) => {
				const resolveDir = dirname(source_id);
				console.log(magenta(`>>>>LOAD JS path, pluginData`), {path, source_id, resolveDir});
				return {contents: await readFile(source_id), loader: 'js', resolveDir};
			},
		);
	},
});
