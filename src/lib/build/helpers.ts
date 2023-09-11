import {createHash} from 'crypto';
import type {Result} from '@feltjs/util/result.js';
import {existsSync} from 'node:fs';
import type {Flavored} from '@feltjs/util/types.js';

import type {BuildConfigInput} from './build_config.js';

// Note that this uses md5 and therefore is not cryptographically secure.
// It's fine for now, but some use cases may need security.
export const to_hash = (buf: Buffer): string =>
	createHash('md5').update(buf).digest().toString('hex');

export const add_js_sourcemap_footer = (code: string, sourcemapPath: string): string =>
	`${code}\n//# sourceMappingURL=${sourcemapPath}`;

export const validate_input_files = (files: string[]): Result<object, {reason: string}> => {
	const results = files.map((input): null | {ok: false; reason: string} => {
		if (!existsSync(input)) {
			return {ok: false, reason: `Input file does not exist: ${input}`};
		}
		return null;
	});
	for (const result of results) {
		if (result) return result;
	}
	return {ok: true};
};

export const is_input_to_build_config = (id: string, inputs: BuildConfigInput[]): boolean => {
	for (const input of inputs) {
		if (id === input) {
			return true;
		}
	}
	return false;
};

export type EcmaScriptTarget = Flavored<string, 'EcmaScriptTarget'>;
