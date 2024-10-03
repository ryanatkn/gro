import {init, parse} from 'es-module-lexer';
import type {Flavored} from '@ryanatkn/belt/types.js';

import type {Path_Id} from './path.js';

export const init_lexer = (): Promise<void> => init;

export type Import_Specifier = Flavored<string, 'Import_Specifier'>;

const script_matcher = /<script.*?>(.*?)<\/script>/gimsu;

// TODO BLOCK ignore `import type` if it's that kind of form
export const parse_imports = (
	id: Path_Id,
	contents: string,
	ignore_types = true,
): Import_Specifier[] => {
	const specifiers: string[] = [];

	const parse_from = (s: string): void => {
		const parsed = parse(s);
		for (const p of parsed[0]) {
			if (ignore_types) {
				const import_statement = s.slice(p.ss, p.se);
				if (import_statement.startsWith('import type')) {
					continue;
				}
			}
			if (p.n) specifiers.push(p.n);
		}
	};

	if (id.endsWith('.svelte')) {
		const matches = contents.matchAll(script_matcher);
		// console.log(`all_script_matches`, Array.from(all_script_matches).length);
		for (const m of matches) {
			parse_from(m[1]);
		}
	} else {
		parse_from(contents);
	}

	return specifiers;
};
