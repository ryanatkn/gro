import {toPackageRepoName, type PackageJson} from '../util/packageJson.js';

export const toSveltekitBasePath = (pkg: PackageJson, dev: boolean): string =>
	dev ? '' : `/${toPackageRepoName(pkg)}`;
