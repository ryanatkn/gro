// TODO refactor to be configurable, probably following Rollup's patterns

export const MODULE_PATH_LIB_PREFIX = '$lib/';
export const MODULE_PATH_SRC_PREFIX = 'src/';

const INTERNAL_MODULE_MATCHER = /^(\.?\.?|src|\$lib)\//;

export const is_external_module = (module_name: string): boolean =>
	!INTERNAL_MODULE_MATCHER.test(module_name);
