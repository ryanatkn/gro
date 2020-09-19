import swc from '@swc/core';
import {ScriptTarget} from 'typescript';

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

export const mergeSwcOptions = (
	options: swc.Options,
	target: swc.JscTarget,
	filename?: string,
): swc.Options => ({
	...options,
	jsc: {
		...options.jsc,
		target,
	},
	filename,
});

export const getDefaultSwcOptions = (): swc.Options => ({
	sourceMaps: true,
	jsc: {
		parser: {syntax: 'typescript', tsx: false, decorators: false, dynamicImport: true},
		externalHelpers: true,
		loose: true, // TODO?
	},
});
