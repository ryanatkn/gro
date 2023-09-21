import {stripEnd, stripStart} from '@feltjs/util/string.js';
import * as lexer from 'es-module-lexer';

import {format_file} from './format_file.js';
import {to_gen_import_path} from './run_gen.js';

await lexer.init;

// This module hackily merges type imports into a minimal set of normalized declarations.
// A proper implementation would parse with TypeScript.
// This one uses `es-module-lexer` and should handle most imports
// but will fail with comments inline in import statements,
// which, given the usecases, users should be able to notice and fix for themselves
// in the very rare cases they do such an odd thing. There may be other corner cases too.
// We could probably safely strip comments before the `from`.
// Formatting with Prettier makes this less gnarly than it would otherwise be because
// it gives good parse errors and makes formatting consistent, but it does make it slower.

export const normalize_type_imports = async (
	raw_imports: string[],
	file_id: string,
): Promise<string[]> => {
	const imports = Array.from(new Set(raw_imports));
	const formatted_imports = (await Promise.all(imports.map((i) => format_file(file_id, i)))).map(
		(s) => s.trim(),
	);

	const imps = new Map<string, ParsedImport>();
	const path = to_gen_import_path(file_id);

	for (let i = 0; i < formatted_imports.length; i++) {
		const formatted_import = stripEnd(formatted_imports[i].trim(), ';');
		const [parsed] = lexer.parse(formatted_import);
		if (!parsed.length) {
			throw Error(`No import found in tsImport: index ${i} in file ${file_id}: ${imports[i]}`);
		}
		if (parsed.length > 1) {
			throw Error(
				`Only one import is allowed in each tsImport: index ${i} in file ${file_id}: ${imports[i]}`,
			);
		}

		const [p] = parsed;
		const {n} = p;

		// ignore dynamic imports and `import.meta`
		if (p.d !== -1 || !n) continue;

		// ignore imports to the `fieldId`
		if (n === path) continue;

		let info = imps.get(n);
		if (!info) {
			info = {path: n, raw: [], parsed: []};
			imps.set(n, info);
		}
		info.raw.push(formatted_import);
		info.parsed.push(p);
	}

	return Array.from(imps.values()).map((v) => printImportInfo(to_import_info(v, file_id)));
};

interface ParsedImport {
	path: string;
	raw: string[];
	parsed: lexer.ImportSpecifier[];
}

interface ImportInfo {
	path: string;
	default_value: string;
	values: string[];
	end: string;
}

const to_import_info = (imp: ParsedImport, file_id: string): ImportInfo => {
	const {path} = imp;

	let default_value = '';
	const values: string[] = [];
	let end = ''; // preserves stuff after the lexed import

	for (let i = 0; i < imp.raw.length; i++) {
		const raw = imp.raw[i];
		const parsed = imp.parsed[i];
		let new_default_value = '';
		const raw_before_path = raw.substring(0, parsed.s - 1);
		const opening_slash_index = raw_before_path.indexOf('{');
		const closing_slash_index =
			opening_slash_index === -1
				? -1
				: raw_before_path.substring(opening_slash_index).indexOf('}') + opening_slash_index;
		const from_match = /\sfrom\s/u.test(
			opening_slash_index === -1
				? raw_before_path
				: raw_before_path.substring(closing_slash_index + 1),
		);
		const raw_before_opening_slash =
			opening_slash_index === -1
				? raw_before_path
				: raw_before_path.substring(0, opening_slash_index);
		const to_default_import = (importStr: string): string =>
			stripEnd(
				raw_before_opening_slash.substring(importStr.length).split(/\s/u).filter(Boolean)[0] || '',
				',',
			);
		if (from_match) {
			if (raw.startsWith('import type ')) {
				const default_type_import = to_default_import('import type ');
				if (default_type_import && opening_slash_index !== -1) {
					throw Error(
						'A type-only import can specify a default import or named bindings, but not both:' +
							` ${file_id} -- ${raw}`,
					);
				}
				if (default_type_import) {
					new_default_value = 'type ' + default_type_import;
				} else if (opening_slash_index !== -1) {
					const parsed_types = raw.substring(opening_slash_index + 1, closing_slash_index);
					values.push(...parsed_types.split(',').map((s) => 'type ' + s.trim()));
				} else {
					throw Error(`Malformed type-only import: ${file_id} -- ${raw}`);
				}
			} else {
				new_default_value = to_default_import('import ');
				if (opening_slash_index !== -1) {
					const parsed_values = raw.substring(opening_slash_index + 1, closing_slash_index);
					values.push(...parsed_values.split(',').map((s) => s.trim()));
				}
			}
		}
		const current_end = raw.substring(parsed.e + 1);
		if (new_default_value && default_value && new_default_value !== default_value) {
			// This is a limitation that ensures we can combine all imports to the same file.
			// Can't think of reasons why you'd want two names for the same default import.
			throw Error(
				'Imported the same default value with two different names:' +
					` ${file_id} -- ${new_default_value} and ${default_value}`,
			);
		}
		if (new_default_value) {
			default_value = new_default_value;
		}
		if (current_end.length > end.length) end = current_end;
	}

	return {
		path,
		default_value,
		values: Array.from(new Set(values)),
		end,
	};
};

const printImportInfo = (info: ImportInfo): string => {
	let result = '';
	const append = (str: string): void => {
		if (result) result += '\n';
		result += str;
	};
	const {end = ''} = info;
	const hasDefault = !!info.default_value;
	if (!hasDefault && !info.values.length) {
		append(`import '${info.path}';` + end);
	}
	if (hasDefault) {
		append(
			'import type ' + stripStart(info.default_value, 'type ') + ` from '${info.path}';` + end,
		);
	}
	if (info.values.length) {
		const strippedTypeValues = info.values.map((v) => stripStart(v, 'type '));
		append(`import type { ${strippedTypeValues.join(', ')} } from '${info.path}';` + end);
	}
	return result;
};
