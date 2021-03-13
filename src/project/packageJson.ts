import {join} from 'path';

import {readJson} from '../fs/nodeFs.js';
import {paths, groPaths, isThisProjectGro} from '../paths.js';
import {Json} from '../utils/json.js';

/*

This is a single entrypoint for getting the `package.json` of both the current project and Gro.
It's helpful because Node's ES modules do not yet support json files without a flag,
and in the future we should be able to easily auto-generate types for them.

*/

export type PackageJson = Obj<Json>; // TODO generate one day
export type GroPackageJson = Obj<Json>; // TODO generate one day

let packageJson: PackageJson | undefined;

export const loadPackageJson = async (forceRefresh = false): Promise<PackageJson> => {
	if (isThisProjectGro) return loadGroPackageJson(forceRefresh);
	if (!packageJson || forceRefresh) {
		packageJson = await readJson(join(paths.root, 'package.json'));
	}
	return packageJson!;
};

let groPackageJson: GroPackageJson | undefined;

export const loadGroPackageJson = async (forceRefresh = false): Promise<GroPackageJson> => {
	if (!groPackageJson || forceRefresh) {
		groPackageJson = await readJson(join(groPaths.root, 'package.json'));
	}
	return groPackageJson!;
};
