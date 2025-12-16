import type {Plugin} from 'vite';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fs_search} from '@fuzdev/fuz_util/fs.js';

import {load_package_json, serialize_package_json, type PackageJsonMapper} from './package_json.ts';
import {source_json_create, source_json_serialize, type SourceJsonMapper} from './source_json.ts';
import {EXPORTS_EXCLUDER_DEFAULT} from './gro_config.ts';
import {SOURCE_DIRNAME} from './constants.ts';

type CopyFileFilter = (file_path: string) => boolean;

export interface VitePluginWellKnownOptions {
	/**
	 * If truthy, outputs `/.well-known/package.json`.
	 * If a function, maps the value.
	 * @default true
	 */
	package_json?: boolean | PackageJsonMapper;

	/**
	 * If truthy, outputs `/.well-known/source.json`.
	 * If a function, maps the value.
	 * @default true
	 */
	source_json?: boolean | SourceJsonMapper;

	/**
	 * If truthy, copies `src/` to `/.well-known/src/`.
	 * Pass a function to customize which files get copied.
	 * @default false
	 */
	src_files?: boolean | CopyFileFilter;
}

interface WellKnownContent {
	package_json: string | null;
	source_json: string | null;
	src_files: Map<string, string> | null;
}

export const vite_plugin_well_known = (options: VitePluginWellKnownOptions = {}): Plugin => {
	const {package_json = true, source_json = true, src_files = false} = options;

	const content: WellKnownContent = {
		package_json: null,
		source_json: null,
		src_files: null,
	};

	const generate_content = async (): Promise<void> => {
		const pkg = await load_package_json();

		// Generate package.json content
		if (package_json) {
			const mapped_pkg = package_json === true ? pkg : await package_json(pkg);
			content.package_json = mapped_pkg ? serialize_package_json(mapped_pkg) : null;
		}

		// Generate source.json content
		if (source_json) {
			const source = await source_json_create(pkg);
			const mapped_source = source_json === true ? source : await source_json(source);
			content.source_json = mapped_source ? source_json_serialize(mapped_source) : null;
		}

		// Collect src files if enabled
		if (src_files) {
			const filter: CopyFileFilter =
				src_files === true ? (file_path) => !EXPORTS_EXCLUDER_DEFAULT.test(file_path) : src_files;

			const files = await fs_search(SOURCE_DIRNAME);
			const filtered_files = files.filter((file) => filter(file.path));

			const file_contents = await Promise.all(
				filtered_files.map(async (file) => ({
					path: file.path,
					content: await readFile(file.id, 'utf8'),
				})),
			);

			const file_map: Map<string, string> = new Map();
			for (const {path, content: file_content} of file_contents) {
				file_map.set(path, file_content);
			}

			content.src_files = file_map.size > 0 ? file_map : null;
		}
	};

	return {
		name: 'vite_plugin_well_known',

		async buildStart() {
			await generate_content();
		},

		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				const url = req.url;
				if (!url?.startsWith('/.well-known/')) {
					next();
					return;
				}

				const path = url.slice('/.well-known/'.length);

				if (path === 'package.json' && content.package_json) {
					res.setHeader('Content-Type', 'application/json');
					res.end(content.package_json);
					return;
				}

				if (path === 'source.json' && content.source_json) {
					res.setHeader('Content-Type', 'application/json');
					res.end(content.source_json);
					return;
				}

				if (path.startsWith('src/') && content.src_files) {
					const file_path = path.slice('src/'.length);
					const file_content = content.src_files.get(file_path);
					if (file_content !== undefined) {
						// Determine content type based on extension
						const ext = file_path.split('.').pop();
						const content_type =
							ext === 'ts' || ext === 'js'
								? 'text/javascript'
								: ext === 'svelte'
									? 'text/html'
									: ext === 'json'
										? 'application/json'
										: ext === 'css'
											? 'text/css'
											: 'text/plain';
						res.setHeader('Content-Type', content_type);
						res.end(file_content);
						return;
					}
				}

				next();
			});
		},

		generateBundle() {
			if (content.package_json) {
				this.emitFile({
					type: 'asset',
					fileName: '.well-known/package.json',
					source: content.package_json,
				});
			}

			if (content.source_json) {
				this.emitFile({
					type: 'asset',
					fileName: '.well-known/source.json',
					source: content.source_json,
				});
			}

			if (content.src_files) {
				for (const [file_path, file_content] of content.src_files) {
					this.emitFile({
						type: 'asset',
						fileName: join('.well-known/src', file_path),
						source: file_content,
					});
				}
			}
		},
	};
};
