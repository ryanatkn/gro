import swc from '@swc/core';

import {DEFAULT_ECMA_SCRIPT_TARGET, EcmaScriptTarget} from './tsBuildHelpers.js';

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
