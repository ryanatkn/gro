import {join} from 'path';
import type {Json} from '@feltcoop/felt/util/json.js';

import type {Filesystem} from '../fs/filesystem.js';
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
export interface GroPackageJson extends PackageJson {} // eslint-disable-line @typescript-eslint/no-empty-interface

let packageJson: Promise<PackageJson> | undefined;
let groPackageJson: Promise<GroPackageJson> | undefined;

export const loadPackageJson = async (
	fs: Filesystem,
	forceRefresh = false,
): Promise<PackageJson> => {
	if (isThisProjectGro) return loadGroPackageJson(fs, forceRefresh);
	if (!packageJson || forceRefresh) {
		packageJson = fs.readFile(join(paths.root, 'package.json'), 'utf8').then((f) => JSON.parse(f));
	}
	return packageJson;
};
export const loadGroPackageJson = async (
	fs: Filesystem,
	forceRefresh = false,
): Promise<GroPackageJson> => {
	if (!groPackageJson || forceRefresh) {
		groPackageJson = fs
			.readFile(join(groPaths.root, 'package.json'), 'utf8')
			.then((f) => JSON.parse(f));
	}
	return groPackageJson;
};

// gets the "b" of "@a/b" for namespaced packages
export const toPackageRepoName = (pkg: PackageJson): string =>
	pkg.name.includes('/') ? pkg.name.split('/').slice(1).join('/') : pkg.name;
