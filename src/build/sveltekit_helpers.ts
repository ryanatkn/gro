import {to_package_repo_name} from '../utils/package_json.js';
import type {Package_Json} from '../utils/package_json.js';

export const to_sveltekit_base_path = (pkg: Package_Json, dev: boolean): string =>
	dev ? '' : `/${to_package_repo_name(pkg)}`;
