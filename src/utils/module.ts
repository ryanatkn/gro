// convenience helper
export const to_is_external_module = (browser: boolean): Is_External_Module =>
	browser ? is_external_browser_module : is_external_node_module;

interface Is_External_Module {
	(module_name: string): boolean;
}

// Browser modules can be relative or absolute paths.
const INTERNAL_BROWSER_MODULE_MATCHER = /^\.?\.?\//;

export const is_external_browser_module: Is_External_Module = (module_name: string): boolean =>
	!INTERNAL_BROWSER_MODULE_MATCHER.test(module_name);

// Node modules can be relative paths, but not absolute.
const INTERNAL_NODE_MODULE_MATCHER = /^\.?\.\//;

export const is_external_node_module: Is_External_Module = (module_name: string): boolean =>
	!INTERNAL_NODE_MODULE_MATCHER.test(module_name);
