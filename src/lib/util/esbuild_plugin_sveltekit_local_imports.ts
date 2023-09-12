import type * as esbuild from 'esbuild';
import {yellow, red, blue, green} from 'kleur/colors';
import {readFileSync} from 'node:fs';

import {parse_specifier} from './esbuild_helpers.js';

export const esbuild_plugin_sveltekit_local_imports = (): esbuild.Plugin => ({
	name: 'sveltekit_local_imports',
	setup: (build) => {
		build.onResolve({filter: /^(\/|\.)/u}, async ({path, ...rest}) => {
			const {importer} = rest;
			console.log(
				blue('[sveltekit_imports] ENTER'),
				'\nimporting ' + yellow(path),
				'\nfrom ' + green(importer),
			);
			console.log(`rest`, rest);
			if (!importer) {
				return {
					path,
					namespace: 'sveltekit_local_imports_entrypoint',
				};
			}

			const parsed = await parse_specifier(path, importer);
			console.log(blue('[sveltekit_imports] EXIT'), parsed);
			const {specifier, source_id, namespace} = parsed;

			// const resolved = await build.resolve(specifier, rest);
			// console.log(`resolved`, resolved);
			return {path: specifier, namespace, pluginData: {source_id}};
		});
		// TODO BLOCK can we remove this?
		build.onLoad(
			{filter: /.*/u, namespace: 'sveltekit_local_imports_entrypoint'},
			async ({path}) => {
				console.log(red(`LOAD entrypoint path`), path);
				return {contents: readFileSync(path), loader: 'ts'};
			},
		);
		build.onLoad(
			{filter: /.*/u, namespace: 'sveltekit_local_imports_ts'},
			async ({path, pluginData: {source_id}}) => {
				console.log(red(`LOAD TS path, pluginData`), path, source_id);
				return {contents: readFileSync(source_id), loader: 'ts'};
			},
		);
		build.onLoad(
			{filter: /.*/u, namespace: 'sveltekit_local_imports_js'},
			async ({path, pluginData: {source_id}}) => {
				console.log(red(`LOAD JS path, pluginData`), path, source_id);
				return {contents: readFileSync(source_id), loader: 'js'};
			},
		);
	},
});
