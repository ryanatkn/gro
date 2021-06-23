// TODO refactor to be configurable, probably following Rollup's patterns

const INTERNAL_MODULE_MATCHER = /^(\.?\.?|src|\$lib)\//;

export const is_external_module = (module_name: string): boolean =>
	!INTERNAL_MODULE_MATCHER.test(module_name);
