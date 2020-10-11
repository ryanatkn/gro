import swc from '@swc/core';
import {basename} from 'path';

import {DEFAULT_ECMA_SCRIPT_TARGET, EcmaScriptTarget} from './tsHelpers.js';

export const getDefaultSwcOptions = (
	target: EcmaScriptTarget = DEFAULT_ECMA_SCRIPT_TARGET,
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

export const addSourceMapFooter = (code: string, sourceMapPath: string): string =>
	`${code}//# sourceMappingURL=${basename(sourceMapPath)}`;
