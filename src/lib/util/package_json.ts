import {join} from 'node:path';
import type {Json} from '@feltjs/util/json.js';
import {readFile, writeFile} from 'node:fs/promises';

import {
	paths,
	gro_paths,
	is_this_project_gro,
	replace_extension,
	SVELTEKIT_DIST_DIRNAME,
} from './paths.js';

// TODO fill out this type
export interface PackageJson {
	[key: string]: Json | undefined;
	name: string;
	main?: string;
	bin?: {[key: string]: string};
	files?: string[];
	exports?: PackageJsonExports;
}
export type PackageJsonExports = Record<string, Record<string, string>>;

export const load_package_json = async (): Promise<PackageJson> =>
	is_this_project_gro
		? load_gro_package_json()
		: JSON.parse(await load_package_json_contents(paths.root));

export const load_gro_package_json = async (): Promise<PackageJson> =>
	JSON.parse(await load_package_json_contents(gro_paths.root));

const load_package_json_contents = (root_dir: string): Promise<string> =>
	readFile(join(root_dir, 'package.json'), 'utf8');

export const write_package_json = async (serialized_pkg: string): Promise<void> => {
	await writeFile(join(paths.root, 'package.json'), serialized_pkg);
};

export const serialize_package_json = (pkg: PackageJson): string =>
	JSON.stringify(pkg, null, 2) + '\n';

/**
 * Updates package.json. Writes to the filesystem only when contents change.
 * @returns boolean indicating if the file changed
 */
export const update_package_json = async (
	update: (pkg: PackageJson) => PackageJson | Promise<PackageJson>,
): Promise<boolean> => {
	const original_pkg_contents = await load_package_json_contents(paths.root);
	const original_pkg = JSON.parse(original_pkg_contents);
	const updated_pkg = await update(original_pkg);
	const updated_contents = serialize_package_json(updated_pkg);
	if (updated_contents === original_pkg_contents) {
		return false;
	}
	await write_package_json(updated_contents);
	return true;
};

export const update_package_json_exports = (exports: PackageJsonExports): Promise<boolean> =>
	update_package_json((pkg) => ({...pkg, exports}));

export const to_package_exports = (paths: string[]): PackageJsonExports => {
	const sorted = paths
		.slice()
		.sort((a, b) => (a === 'index.ts' ? -1 : b === 'index.ts' ? 1 : a.localeCompare(b)));
	const exports: PackageJsonExports = {};
	for (const path of sorted) {
		if (path.endsWith('.ts')) {
			const js_path = replace_extension(path, '.js');
			const key = path === 'index.ts' ? '.' : './' + js_path;
			exports[key] = {
				default: IMPORT_PREFIX + js_path,
				types: IMPORT_PREFIX + replace_extension(path, '.d.ts'),
			};
		} else if (path.endsWith('.js')) {
			const key = path === 'index.js' ? '.' : './' + path;
			exports[key] = {
				default: IMPORT_PREFIX + path,
				types: IMPORT_PREFIX + replace_extension(path, '.d.ts'), // assuming JSDoc types
			};
		} else if (path.endsWith('.svelte')) {
			exports['./' + path] = {
				svelte: IMPORT_PREFIX + path,
				types: IMPORT_PREFIX + path + '.d.ts',
			};
		} else {
			exports['./' + path] = {
				default: IMPORT_PREFIX + path,
			};
		}
	}
	return exports;
};

const IMPORT_PREFIX = './' + SVELTEKIT_DIST_DIRNAME + '/';
