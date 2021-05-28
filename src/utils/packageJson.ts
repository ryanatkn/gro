import {join} from 'path';
import type {Json} from '@feltcoopp/felt/utils/json.js';

import type {Filesystem} from '../fs/filesystem.js';
import {paths, groPaths, isThisProjectGro} from '../paths.js';

/*

This is a single entrypoint for getting the `package.json` of both the current project and Gro.
It's helpful because Node's ES modules do not yet support json files without a flag,
and in the future we should be able to easily auto-generate types for them.

TODO we probably want to extract this to felt

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
		packageJson = JSON.parse(await fs.readFile(join(paths.root, 'package.json'), 'utf8'));
	}
	return packageJson!;
};
export const loadGroPackageJson = async (
	fs: Filesystem,
	forceRefresh = false,
): Promise<GroPackageJson> => {
	if (!groPackageJson || forceRefresh) {
		groPackageJson = JSON.parse(await fs.readFile(join(groPaths.root, 'package.json'), 'utf8'));
	}
	return groPackageJson!;
};

// gets the "b" of "@a/b" for namespaced packages
export const toPackageRepoName = (pkg: PackageJson): string =>
	pkg.name.includes('/') ? pkg.name.split('/').slice(1).join('/') : pkg.name;
