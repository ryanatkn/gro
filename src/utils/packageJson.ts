import {join} from 'path';
import {type Json} from '@feltcoop/felt/util/json.js';

import {type Filesystem} from 'src/fs/filesystem.js';
import {paths, groPaths, isThisProjectGro} from '../paths.js';

// This is a single entrypoint for getting the `package.json` of both the current project and Gro.
// It's cached but can be reloaded with `forceRefresh` flag.

// TODO fill out this type
export interface PackageJson {
	[key: string]: Json | undefined;
	name: string;
	main?: string;
	bin?: {[key: string]: string};
	files?: string[];
	exports?: Record<string, string>;
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
