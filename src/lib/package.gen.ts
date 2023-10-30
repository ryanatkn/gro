import {Project} from 'ts-morph';

import type {Gen} from './gen.js';
import {PackageJsonExports, load_package_json} from './package_json.js';
import {is_this_project_gro, replace_extension} from './paths.js';
import {strip_start} from '@grogarden/util/string.js';

export interface Module_Declaration {
	name: string; // identifier
	type: string; // `getType()`
}

// TODO BLOCK move
export interface Package_Module {
	id: string;
	declarations: Module_Declaration[];
}

export type Package_Modules = Record<string, Package_Module>;

const to_package_modules = async (
	exports: PackageJsonExports | undefined,
): Promise<Package_Modules | undefined> => {
	if (!exports) return undefined;

	const project = new Project();
	project.addSourceFilesAtPaths('src/**/*.ts'); // TODO dir?

	return Object.fromEntries(
		await Promise.all(
			Object.entries(exports).map(async ([k, v]) => {
				// TODO hacky - add a gro helper?
				const raw_source_file_id = strip_start(
					k.endsWith('.js') ? replace_extension(k, '.ts') : k,
					'./',
				);
				const source_file_id = raw_source_file_id === '.' ? 'index.ts' : raw_source_file_id;

				const declarations = [];

				const source_file = project.getSourceFileOrThrow(source_file_id);
				for (const [name, _decls] of source_file.getExportedDeclarations()) {
					console.log(`name`, raw_source_file_id, name);
					// TODO BLOCK multiples ? change our data structure?
					declarations.push({name});
					// for (const decl of decls) {
					// TODO this isn't what we want
					// decl.getType().getText(source_file)
					// }
				}

				return [k, {id: source_file_id, declarations}];
			}),
		),
	);
};

// TODO consider an api that uses magic imports like SvelteKit's `$app`, like `$repo/package.json`

/**
 * A convenience `gen` file that outputs `$lib/package.ts`,
 * which mirrors `package.json` but in TypeScript,
 * allowing apps to import typesafe data from their own `package.json`.
 */
export const gen: Gen = async () => {
	const package_json = await load_package_json();

	// TODO BLOCK remove this from here, belongs only for well-known and package.ts
	const modules = await to_package_modules(package_json.exports);

	package_json.modules = modules;
	console.log(`modules`, modules);

	return `
import type {PackageJson} from '${
		is_this_project_gro ? './package_json.js' : '@grogarden/gro/package_json.js'
	}';

export const package_json = ${JSON.stringify(package_json)} satisfies PackageJson;
	`;
};
