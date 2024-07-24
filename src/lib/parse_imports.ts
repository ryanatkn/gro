import {init, parse} from 'es-module-lexer';
import type {Flavored} from '@ryanatkn/belt/types.js';
import type {Path_Id} from './path.js';

let initing: Promise<void> | undefined;

export const init_lexer = (): Promise<void> => {
	if (initing !== undefined) return initing;
	return (initing = Promise.resolve().then(() => init));
};

export type Import_Specifier = Flavored<string, 'Import_Specifier'>;

const script_matcher = /<script.*?>(.*?)<\/script>/gimsu;

export const parse_imports = (id: Path_Id, contents: string): Import_Specifier[] => {
	const specifiers = [];

	if (id.endsWith('.svelte')) {
		// TODO BLOCK svelte regexp extractor? get from Svelte

		const matches = contents.matchAll(script_matcher);
		// console.log(`all_script_matches`, Array.from(all_script_matches).length);
		for (const m of matches) {
			const e = m[1];
			console.log(`e`, e);
			const parsed = parse(e);
			console.log(`parsed svelte`, parsed);
			for (const p of parsed[0]) {
				specifiers.push(p.n);
			}
		}
	} else {
		const parsed = parse(contents);
		for (const p of parsed[0]) {
			specifiers.push(p.n);
		}
		console.log(`parsed ts`, parsed);
	}

	return specifiers;
};
