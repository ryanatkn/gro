import {join} from 'node:path';
import type {Json} from '@feltjs/util/json.js';

import type {Filesystem} from '../fs/filesystem.js';
import {paths, gro_paths, is_this_project_gro} from '../path/paths.js';

// This is a single entrypoint for getting the `package.json` of both the current project and Gro.
// It's cached but can be reloaded with `force_refresh` flag.

// TODO fill out this type
export interface PackageJson {
	[key: string]: Json | undefined;
	name: string;
	main?: string;
	bin?: {[key: string]: string};
	files?: string[];
	exports?: Record<string, string>;
}
export interface GroPackageJson extends PackageJson {} // eslint-disable-line @typescript-eslint/no-empty-interface

let package_json: Promise<PackageJson> | undefined;
let gro_package_json: Promise<GroPackageJson> | undefined;

export const load_package_json = async (
	fs: Filesystem,
	force_refresh = false,
): Promise<PackageJson> => {
	if (is_this_project_gro) return load_gro_package_json(fs, force_refresh);
	if (!package_json || force_refresh) {
		package_json = fs.readFile(join(paths.root, 'package.json'), 'utf8').then((f) => JSON.parse(f));
	}
	return package_json;
};
export const load_gro_package_json = async (
	fs: Filesystem,
	force_refresh = false,
): Promise<GroPackageJson> => {
	if (!gro_package_json || force_refresh) {
		gro_package_json = fs
			.readFile(join(gro_paths.root, 'package.json'), 'utf8')
			.then((f) => JSON.parse(f));
	}
	return gro_package_json;
};
