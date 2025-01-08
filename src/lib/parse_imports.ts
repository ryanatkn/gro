import {parseSync} from 'oxc-parser'; // TODO see https://github.com/oxc-project/oxc/issues/7788 and https://github.com/oxc-project/oxc/blob/main/napi/parser/test/__snapshots__/esm.test.ts.snap
import type {Flavored} from '@ryanatkn/belt/types.js';

import type {Path_Id} from './path.js';
import {SVELTE_MATCHER} from './svelte_helpers.js';
import {JS_MATCHER, TS_MATCHER} from './constants.js';

export type Import_Specifier = Flavored<string, 'Import_Specifier'>;

const script_matcher = /<script.*?>(.*?)<\/script>/gimsu;

export const parse_imports = (
	id: Path_Id,
	contents: string,
	ignore_types = true,
): Array<Import_Specifier> => {
	const specifiers: Array<string> = [];

	const is_svelte = SVELTE_MATCHER.test(id);

	const parse_from = (s: string): void => {
		const parsed = parseSync(is_svelte ? id + '.ts' : id, s);
		console.log(`parsed.module`, parsed.module);

		for (const p of parsed.module.staticImports) {
			if (ignore_types) {
				const import_statement = s.slice(p.start, p.end);
				if (import_statement.startsWith('import type')) {
					continue;
				}
			}
			if (p.moduleRequest.value) specifiers.push(p.moduleRequest.value);
		}
	};

	if (is_svelte) {
		const matches = contents.matchAll(script_matcher);
		for (const m of matches) {
			parse_from(m[1]);
		}
	} else if (TS_MATCHER.test(id) || JS_MATCHER.test(id)) {
		parse_from(contents);
	}

	return specifiers;
};
