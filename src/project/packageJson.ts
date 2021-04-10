import {join} from 'path';
import type {Filesystem} from '../fs/filesystem.js';

import {paths, groPaths, isThisProjectGro} from '../paths.js';
import type {Json} from '../utils/json.js';

/*

This is a single entrypoint for getting the `package.json` of both the current project and Gro.
It's helpful because Node's ES modules do not yet support json files without a flag,
and in the future we should be able to easily auto-generate types for them.

*/

export interface PackageJson {
	[key: string]: Json;
	name: string;
}
export interface GroPackageJson extends PackageJson {}

let packageJson: PackageJson | undefined;
let groPackageJson: GroPackageJson | undefined;

export const loadPackageJson = async (
	fs: Filesystem,
	forceRefresh = false,
): Promise<PackageJson> => {
	if (isThisProjectGro) return loadGroPackageJson(fs, forceRefresh);
	if (!packageJson || forceRefresh) {
		packageJson = await fs.readJson(join(paths.root, 'package.json'));
	}
	return packageJson!;
};
export const loadGroPackageJson = async (
	fs: Filesystem,
	forceRefresh = false,
): Promise<GroPackageJson> => {
	if (!groPackageJson || forceRefresh) {
		groPackageJson = await fs.readJson(join(groPaths.root, 'package.json'));
	}
	return groPackageJson!;
};

// gets the "b" of "@a/b" for namespaced packages
export const toPackageRepoName = (pkg: PackageJson): string =>
	pkg.name.includes('/') ? pkg.name.split('/').slice(1).join('/') : pkg.name;
