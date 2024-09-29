import {init, parse} from 'es-module-lexer';
import type {Flavored} from '@ryanatkn/belt/types.js';
import type {Path_Id} from './path.js';

export const init_lexer = (): Promise<void> => init;

export type Import_Specifier = Flavored<string, 'Import_Specifier'>;

const script_matcher = /<script.*?>(.*?)<\/script>/gimsu;

export const parse_imports = (id: Path_Id, contents: string): Import_Specifier[] => {
	const specifiers: string[] = [];

	if (id.endsWith('.svelte')) {
		const matches = contents.matchAll(script_matcher);
		// console.log(`all_script_matches`, Array.from(all_script_matches).length);
		for (const m of matches) {
			const e = m[1];
			const parsed = parse(e);
			for (const p of parsed[0]) {
				if (p.n) specifiers.push(p.n);
			}
		}
	} else {
		const parsed = parse(contents);
		for (const p of parsed[0]) {
			if (p.n) specifiers.push(p.n);
		}
	}

	return specifiers;
};
