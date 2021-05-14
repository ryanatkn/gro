import {toPackageRepoName} from '../utils/packageJson.js';
import type {PackageJson} from '../utils/packageJson.js';

export const toSvelteKitBasePath = (pkg: PackageJson, dev: boolean): string =>
	dev ? '' : `/${toPackageRepoName(pkg)}`;
