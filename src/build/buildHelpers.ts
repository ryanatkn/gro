export const addJsSourceMapFooter = (code: string, sourceMapPath: string): string =>
	`${code}\n//# sourceMappingURL=${sourceMapPath}`;

export const addCssSourceMapFooter = (code: string, sourceMapPath: string): string =>
	`${code}\n/*# sourceMappingURL=${sourceMapPath} */`;
