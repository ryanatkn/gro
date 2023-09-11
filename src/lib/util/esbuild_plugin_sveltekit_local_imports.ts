import type * as esbuild from 'esbuild';
import {yellow, red, blue, green} from 'kleur/colors';
import {readFileSync} from 'node:fs';

import {parse_specifier} from './esbuild.js';

export const esbuild_plugin_sveltekit_local_imports = (): esbuild.Plugin => ({
	name: 'sveltekit_local_imports',
	setup: (build) => {
		build.onResolve({filter: /^(\/|\.)/u}, async ({path, ...rest}) => {
			const {importer} = rest;
			console.log(
				blue('[sveltekit_imports] ENTER path, importer'),
				green('1'),
				yellow(path),
				'\n',
				green(importer),
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
			const {final_path, source_path, namespace} = parsed;

			// const resolved = await build.resolve(final_path, rest);
			// console.log(`resolved`, resolved);
			return {path: final_path, namespace, pluginData: {source_path}};
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
			async ({path, pluginData: {source_path}}) => {
				console.log(red(`LOAD TS path, pluginData`), path, source_path);
				return {contents: readFileSync(source_path), loader: 'ts'};
			},
		);
		build.onLoad(
			{filter: /.*/u, namespace: 'sveltekit_local_imports_js'},
			async ({path, pluginData: {source_path}}) => {
				console.log(red(`LOAD JS path, pluginData`), path, source_path);
				return {contents: readFileSync(source_path), loader: 'js'};
			},
		);
	},
});
