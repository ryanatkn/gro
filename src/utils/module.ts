// convenience helper
export const getIsExternalModule = (isBrowser: boolean): IsExternalModule =>
	isBrowser ? isExternalBrowserModule : isExternalNodeModule;

interface IsExternalModule {
	(moduleName: string): boolean;
}

// Browser modules can be relative or absolute paths.
const INTERNAL_BROWSER_MODULE_MATCHER = /^\.?\.?\//;

export const isExternalBrowserModule: IsExternalModule = (moduleName: string): boolean =>
	!INTERNAL_BROWSER_MODULE_MATCHER.test(moduleName);

// Node modules can be relative paths, but not absolute.
const INTERNAL_NODE_MODULE_MATCHER = /^\.?\.\//;

export const isExternalNodeModule: IsExternalModule = (moduleName: string): boolean =>
	!INTERNAL_NODE_MODULE_MATCHER.test(moduleName);
