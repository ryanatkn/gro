// TODO refactor to be configurable, probably following Rollup's patterns

import {SOURCE_DIR, SOURCE_DIRNAME, LIB_DIRNAME} from '../path/paths.js';

export const MODULE_PATH_SRC_PREFIX = SOURCE_DIR;
export const MODULE_PATH_LIB_PREFIX = `$${LIB_DIRNAME}/`;

const INTERNAL_MODULE_MATCHER = new RegExp(
	`^(\\.?\\.?|${SOURCE_DIRNAME}|\\$${LIB_DIRNAME})\\/`,
	'u',
);

export const is_external_module = (moduleName: string): boolean =>
	!INTERNAL_MODULE_MATCHER.test(moduleName);
