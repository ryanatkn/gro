// Browser modules can be relative or absolute paths.
const INTERNAL_BROWSER_MODULE_MATCHER = /^\.?\.?\//;

export const isExternalBrowserModule = (moduleName: string): boolean =>
	!INTERNAL_BROWSER_MODULE_MATCHER.test(moduleName);

// Node modules can be relative paths, but not absolute.
const INTERNAL_NODE_MODULE_MATCHER = /^\.?\.\//;

export const isExternalNodeModule = (moduleName: string): boolean =>
	!INTERNAL_NODE_MODULE_MATCHER.test(moduleName);
