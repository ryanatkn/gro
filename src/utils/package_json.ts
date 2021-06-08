import {join} from 'path';
import type {Json} from '@feltcoop/felt/utils/json.js';

import type {Filesystem} from '../fs/filesystem.js';
import {paths, gro_paths, is_this_project_gro} from '../paths.js';

/*

This is a single entrypoint for getting the `package.json` of both the current project and Gro.
It's helpful because Node's ES modules do not yet support json files without a flag,
and in the future we should be able to easily auto-generate types for them.

TODO we probably want to extract this to felt

*/

export interface Package_Json {
	[key: string]: Json;
	name: string;
}
export interface Gro_Package_Json extends Package_Json {}

let package_json: Package_Json | undefined;
let gro_package_json: Gro_Package_Json | undefined;

export const load_package_json = async (
	fs: Filesystem,
	forceRefresh = false,
): Promise<Package_Json> => {
	if (is_this_project_gro) return load_gro_package_json(fs, forceRefresh);
	if (!package_json || forceRefresh) {
		package_json = JSON.parse(await fs.readFile(join(paths.root, 'package.json'), 'utf8'));
	}
	return package_json!;
};
export const load_gro_package_json = async (
	fs: Filesystem,
	forceRefresh = false,
): Promise<Gro_Package_Json> => {
	if (!gro_package_json || forceRefresh) {
		gro_package_json = JSON.parse(await fs.readFile(join(gro_paths.root, 'package.json'), 'utf8'));
	}
	return gro_package_json!;
};

// gets the "b" of "@a/b" for namespaced packages
export const to_package_repo_name = (pkg: Package_Json): string =>
	pkg.name.includes('/') ? pkg.name.split('/').slice(1).join('/') : pkg.name;
