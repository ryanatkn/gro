// convenience helper
export const to_is_external_module = (isBrowser: boolean): IsExternalModule =>
	isBrowser ? is_external_browser_module : isExternalNodeModule;

interface IsExternalModule {
	(moduleName: string): boolean;
}

// Browser modules can be relative or absolute paths.
const INTERNAL_BROWSER_MODULE_MATCHER = /^\.?\.?\//;

export const is_external_browser_module: IsExternalModule = (moduleName: string): boolean =>
	!INTERNAL_BROWSER_MODULE_MATCHER.test(moduleName);

// Node modules can be relative paths, but not absolute.
const INTERNAL_NODE_MODULE_MATCHER = /^\.?\.\//;

export const isExternalNodeModule: IsExternalModule = (moduleName: string): boolean =>
	!INTERNAL_NODE_MODULE_MATCHER.test(moduleName);
