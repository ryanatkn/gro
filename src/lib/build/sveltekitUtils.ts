import {toPackageRepoName, type PackageJson} from '../utils/packageJson.js';

export const toSveltekitBasePath = (pkg: PackageJson, dev: boolean): string =>
	dev ? '' : `/${toPackageRepoName(pkg)}`;
