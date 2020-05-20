import {join} from 'path';

import {readJsonSync} from '../fs/nodeFs.js';
import {paths, groPaths} from '../paths.js';
import {Json} from '../utils/json.js';

// This is a single entrypoint for getting the `packge.json` of both the current project and Gro.
// It's helpful because Node's ES modules do not yet support json files without a flag,
// and in the future we should be able to easily auto-generate types for them.

type PackageJson = Obj<Json>; // TODO generate one day
type GroPackageJson = Obj<Json>; // TODO generate one day

let packageJson: PackageJson | undefined;

export const getPackageJson = (): PackageJson => {
	if (!packageJson) {
		packageJson = readJsonSync(join(paths.root, 'package.json'));
	}
	return packageJson!;
};

let groPackageJson: GroPackageJson | undefined;

export const getGroPackageJson = (): GroPackageJson => {
	if (!groPackageJson) {
		groPackageJson =
			paths === groPaths ? getPackageJson() : readJsonSync(join(groPaths.root, 'package.json'));
	}
	return groPackageJson!;
};
