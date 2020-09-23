import swc from '@swc/core';
import type {ScriptTarget} from 'typescript';
import {dirname, relative, basename} from 'path';

import {toBuildId, toSourceId} from '../paths.js';

const DEFAULT_TARGET = 'es2019'; // TODO?

export const toSwcCompilerTarget = (target: ScriptTarget | undefined): swc.JscTarget => {
	switch (target) {
		case 0: // ES3 = 0,
			return 'es3';
		case 1: // ES5 = 1,
			return 'es5';
		case 2: // ES2015 = 2,
			return 'es2015';
		case 3: // ES2016 = 3,
			return 'es2016';
		case 4: // ES2017 = 4,
			return 'es2017';
		case 5: // ES2018 = 5,
			return 'es2018';
		case 6: // ES2019 = 6,
			return 'es2019';
		// ES2020 = 7,
		// ESNext = 99,
		// JSON = 100,
		// Latest = 99
		default:
			return DEFAULT_TARGET;
	}
};

export const mergeSwcOptions = (options: swc.Options, sourcePath: string): swc.Options => ({
	...options,
	filename: sourcePath ? sourcePathToSwcFilename(sourcePath) : undefined,
});

export const getDefaultSwcOptions = (
	target: swc.JscTarget = DEFAULT_TARGET,
	sourceMap = true, // sticking with the naming convention of TypeScript and some other libs
): swc.Options => ({
	sourceMaps: sourceMap,
	jsc: {
		parser: {syntax: 'typescript', tsx: false, decorators: false, dynamicImport: true},
		target,
		externalHelpers: true,
		loose: true, // TODO?
	},
});

const sourcePathToSwcFilename = (sourcePath: string): string =>
	relative(dirname(toBuildId(sourcePath)), toSourceId(sourcePath));

export const addSourceMapFooter = (code: string, sourceMapPath: string): string =>
	`${code}//# sourceMappingURL=${basename(sourceMapPath)}`;
