import {stripEnd, stripStart} from '@feltjs/util/string.js';
import * as lexer from 'es-module-lexer';

import {formatFile} from '../../format/formatFile.js';
import type {Filesystem} from '../../fs/filesystem.js';
import {toGenImportPath} from '../runGen.js';

await lexer.init;

// This module hackily merges type imports into a minimal set of normalized declarations.
// A proper implementation would parse with TypeScript;
// this one should handle most imports but will fail with comments inline in import statements,
// which, given the usecases, users should be able to notice and fix for themselves
// in the very rare cases they do such an odd thing.
// We could probably safely strip comments before the `from`,
// but this is already much better than minimal `importTs` processing,
// and if users do such a strange thing they can probably fix it.
// Prettier makes this less gnarly than it appears because
// it gives good parse errors and makes formatting consistent.

export const normalizeTypeImports = async (
	fs: Filesystem,
	rawImports: string[],
	fileId: string,
): Promise<string[]> => {
	const imports = Array.from(new Set(rawImports));
	const formattedImports = (await Promise.all(imports.map((i) => formatFile(fs, fileId, i)))).map(
		(s) => s.trim(),
	);

	const imps = new Map<string, ParsedImport>();
	const path = toGenImportPath(fileId);

	for (let i = 0; i < formattedImports.length; i++) {
		const formattedImport = stripEnd(formattedImports[i].trim(), ';');
		const [parsed] = lexer.parse(formattedImport);
		if (!parsed.length) {
			throw Error(`No import found in tsImport: index ${i} in file ${fileId}: ${imports[i]}`);
		}
		if (parsed.length > 1) {
			throw Error(
				`Only one import is allowed in each tsImport: index ${i} in file ${fileId}: ${imports[i]}`,
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
		info.raw.push(formattedImport);
		info.parsed.push(p);
	}

	return Array.from(imps.values()).map((v) => printImportInfo(toImportInfo(v, fileId)));
};

interface ParsedImport {
	path: string;
	raw: string[];
	parsed: lexer.ImportSpecifier[];
}

interface ImportInfo {
	path: string;
	defaultValue: string;
	values: string[];
	end: string;
}

const toImportInfo = (imp: ParsedImport, fileId: string): ImportInfo => {
	const {path} = imp;

	let defaultValue = '';
	const values: string[] = [];
	let end = ''; // preserves stuff after the lexed import

	for (let i = 0; i < imp.raw.length; i++) {
		const raw = imp.raw[i];
		const parsed = imp.parsed[i];
		let newDefaultValue = '';
		const rawBeforePath = raw.substring(0, parsed.s - 1);
		const openingSlashIndex = rawBeforePath.indexOf('{');
		const closingSlashIndex =
			openingSlashIndex === -1
				? -1
				: rawBeforePath.substring(openingSlashIndex).indexOf('}') + openingSlashIndex;
		const fromMatch = /\sfrom\s/u.test(
			openingSlashIndex === -1 ? rawBeforePath : rawBeforePath.substring(closingSlashIndex + 1),
		);
		const rawBeforeOpeningSlash =
			openingSlashIndex === -1 ? rawBeforePath : rawBeforePath.substring(0, openingSlashIndex);
		const toDefaultImport = (importStr: string): string =>
			stripEnd(
				rawBeforeOpeningSlash.substring(importStr.length).split(/\s/u).filter(Boolean)[0] || '',
				',',
			);
		if (fromMatch) {
			if (raw.startsWith('import type ')) {
				const defaultTypeImport = toDefaultImport('import type ');
				if (defaultTypeImport && openingSlashIndex !== -1) {
					throw Error(
						'A type-only import can specify a default import or named bindings, but not both:' +
							` ${fileId} -- ${raw}`,
					);
				}
				if (defaultTypeImport) {
					newDefaultValue = 'type ' + defaultTypeImport;
				} else if (openingSlashIndex !== -1) {
					const parsedTypes = raw.substring(openingSlashIndex + 1, closingSlashIndex);
					values.push(...parsedTypes.split(',').map((s) => 'type ' + s.trim()));
				} else {
					throw Error(`Malformed type-only import: ${fileId} -- ${raw}`);
				}
			} else {
				newDefaultValue = toDefaultImport('import ');
				if (openingSlashIndex !== -1) {
					const parsedValues = raw.substring(openingSlashIndex + 1, closingSlashIndex);
					values.push(...parsedValues.split(',').map((s) => s.trim()));
				}
			}
		}
		const currentEnd = raw.substring(parsed.e + 1);
		if (newDefaultValue && defaultValue && newDefaultValue !== defaultValue) {
			// This is a limitation that ensures we can combine all imports to the same file.
			// Can't think of reasons why you'd want two names for the same default import.
			throw Error(
				'Imported the same default value with two different names:' +
					` ${fileId} -- ${newDefaultValue} and ${defaultValue}`,
			);
		}
		if (newDefaultValue) {
			defaultValue = newDefaultValue;
		}
		if (currentEnd.length > end.length) end = currentEnd;
	}

	return {
		path,
		defaultValue,
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
	const hasDefault = !!info.defaultValue;
	if (!hasDefault && !info.values.length) {
		append(`import '${info.path}';` + end);
	}
	if (hasDefault) {
		append('import type ' + stripStart(info.defaultValue, 'type ') + ` from '${info.path}';` + end);
	}
	if (info.values.length) {
		const strippedTypeValues = info.values.map((v) => stripStart(v, 'type '));
		append(`import type { ${strippedTypeValues.join(', ')} } from '${info.path}';` + end);
	}
	return result;
};
