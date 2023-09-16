import type * as esbuild from 'esbuild';
import {yellow, blue, magenta} from 'kleur/colors';
import {readFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';

import {resolve_specifier} from './resolve_specifier.js';

export const esbuild_plugin_sveltekit_local_imports = (): esbuild.Plugin => ({
	name: 'sveltekit_local_imports',
	setup: (build) => {
		build.onResolve({filter: /^(\/|\.)/u}, async (args) => {
			const {path, importer, resolveDir} = args;
			console.log(
				blue('[sveltekit_imports] ENTER'),
				'\n    specifying path  ' + yellow(path),
				'\n    from importer    ' + yellow(importer),
				'\n    with resolveDir  ' + yellow(resolveDir),
			);
			if (!importer) {
				console.log(blue('[sveltekit_imports] EXIT EARLY without importer'), yellow(path));
				return {
					path,
					namespace: 'sveltekit_local_imports_entrypoint',
				};
			}

			const {specifier, source_id, namespace} = await resolve_specifier(
				path,
				dirname(importer[0] === '/' ? importer : join(resolveDir, importer)),
			);
			console.log(
				blue('    [sveltekit_imports] EXIT'),
				'\n        specifier       ' + yellow(specifier),
				'\n        source_id       ' + source_id,
				'\n        namespace       ' + namespace,
			);

			return namespace ? {path: specifier, namespace, pluginData: {source_id, resolveDir}} : {path};
		});
		// TODO BLOCK can we remove this?
		build.onLoad(
			{filter: /.*/u, namespace: 'sveltekit_local_imports_entrypoint'},
			async ({path}) => {
				const resolveDir = dirname(path);
				console.log(magenta(`>>>>LOAD entrypoint path`), path);
				// TODO BLOCK can we return the source id as path, or does that make it in the source?
				return {contents: await readFile(path), loader: 'ts', resolveDir};
			},
		);
		build.onLoad(
			{filter: /.*/u, namespace: 'sveltekit_local_imports_ts'},
			async ({path, pluginData: {source_id, resolveDir}}) => {
				console.log(magenta(`>>>>LOAD TS path, pluginData`), {path, source_id, resolveDir});
				return {contents: await readFile(source_id), loader: 'ts', resolveDir};
			},
		);
		build.onLoad(
			{filter: /.*/u, namespace: 'sveltekit_local_imports_js'},
			async ({path, pluginData: {source_id, resolveDir}}) => {
				console.log(magenta(`>>>>LOAD JS path, pluginData`), {path, source_id, resolveDir});
				return {contents: await readFile(source_id), loader: 'js', resolveDir};
			},
		);
	},
});
