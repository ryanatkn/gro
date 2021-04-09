import {toPackageRepoName} from '../project/packageJson.js';
import type {PackageJson} from '../project/packageJson.js';

export const toSvelteKitBasePath = (pkg: PackageJson, dev: boolean): string =>
	dev ? '' : `/${toPackageRepoName(pkg)}`;
