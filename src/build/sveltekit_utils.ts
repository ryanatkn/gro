import {to_package_repo_name} from '../utils/package_json.js';
import type {PackageJson} from 'src/utils/package_json.js';

export const to_sveltekit_base_path = (pkg: PackageJson, dev: boolean): string =>
	dev ? '' : `/${to_package_repo_name(pkg)}`;
