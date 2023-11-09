import {z} from 'zod';
import {join} from 'node:path';
import {strip_start} from '@grogarden/util/string.js';
import type {Logger} from '@grogarden/util/log.js';
import {Project} from 'ts-morph';

import {paths, replace_extension} from './paths.js';
import {exists} from './exists.js';
import type {Package_Json, Package_Json_Exports} from './package_json.js';

export const Src_Module_Declaration = z
	.object({
		name: z.string(), // identifier
		kind: z.string(), // `getKing()`
		// type: string; // `getType()`
	})
	.passthrough();
export type Src_Module_Declaration = z.infer<typeof Src_Module_Declaration>;

export const Src_Module = z
	.object({
		path: z.string(),
		declarations: z.array(Src_Module_Declaration),
	})
	.passthrough();
export type Src_Module = z.infer<typeof Src_Module>;

export const Src_Modules = z.record(Src_Module);
export type Src_Modules = z.infer<typeof Src_Modules>;

/**
 * @see https://github.com/grogarden/gro/blob/main/src/lib/docs/gro_plugin_sveltekit_frontend.md#well-known-src
 */
export const Src_Json = z.intersection(
	z.record(z.unknown()), // TODO is this what we want?
	z
		.object({
			name: z.string(), // same as Package_Json
			version: z.string(), // same as Package_Json
			modules: Src_Modules.optional(),
		})
		.passthrough(),
);
export type Src_Json = z.infer<typeof Src_Json>;

export interface Map_Src_Json {
	(pkg: Src_Json): Src_Json | null | Promise<Src_Json | null>;
}

export const create_src_json = async (package_json: Package_Json): Promise<Src_Json> => {
	return {
		name: package_json.name,
		version: package_json.version,
		modules: await to_src_modules(package_json.exports),
	};
};

export const serialize_src_json = (pkg: Src_Json): string => {
	Src_Json.parse(pkg);
	return JSON.stringify(pkg, null, 2) + '\n';
};

// TODO do this with zod?
/**
 * Mutates `pkg` to normalize it for convenient usage.
 * For example, users don't have to worry about empty `exports` objects,
 * which fail schema validation.
 */
export const normalize_src_json = (src: Src_Json): Src_Json => {
	// TODO BLOCK use this
	if (src.modules && Object.keys(src.modules).length === 0) {
		src.modules = undefined;
	}
	return src;
};

export const to_src_modules = async (
	exports: Package_Json_Exports | undefined,
	log?: Logger,
	base_path = paths.lib,
): Promise<Src_Modules | undefined> => {
	if (!exports) return undefined;

	const project = new Project();
	project.addSourceFilesAtPaths('src/**/*.ts'); // TODO dir? maybe rewrite with `base_path`?

	return Object.fromEntries(
		(
			await Promise.all(
				Object.entries(exports).map(async ([k, _v]) => {
					// TODO hacky - doesn't handle any but the normal mappings, also add a helper?
					const source_file_path =
						k === '.' || k === './'
							? 'index.ts'
							: strip_start(k.endsWith('.js') ? replace_extension(k, '.ts') : k, './');
					if (!source_file_path.endsWith('.ts')) {
						// TODO support more than just TypeScript - probably use @sveltejs/language-tools, see how @sveltejs/package generates types
						const package_module: Src_Module = {path: source_file_path, declarations: []};
						return [k, package_module];
					}
					const source_file_id = join(base_path, source_file_path);
					if (!(await exists(source_file_id))) {
						log?.warn(
							'failed to infer source file from export path',
							k,
							'- the inferred file',
							source_file_id,
							'does not exist',
						);
						return null!;
					}

					const declarations: Src_Module_Declaration[] = [];

					const source_file = project.getSourceFile((f) =>
						f.getFilePath().endsWith(source_file_path),
					); // TODO expected this to work without the callback, according to my read of the docs it is, but `project.getSourceFile(source_file_path)` fails
					if (source_file) {
						for (const [name, decls] of source_file.getExportedDeclarations()) {
							if (!decls) continue;
							// TODO how to correctly handle multiples?
							for (const decl of decls) {
								// TODO helper
								const found = declarations.find((d) => d.name === name);
								const kind = decl.getKindName();
								if (found) {
									// TODO hacky, this only was added to prevent `TypeAliasDeclaration` from overriding `VariableDeclaration`
									if (found.kind !== 'VariableDeclaration') {
										found.kind = kind;
									}
								} else {
									// TODO more
									declarations.push({name, kind});
								}
							}
						}
					}

					const package_module: Src_Module = {path: source_file_path, declarations};
					return [k, package_module];
				}),
			)
		).filter(Boolean),
	);
};
