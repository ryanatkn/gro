import {compile} from '@ryanatkn/json-schema-to-typescript';
import {stripEnd} from '@feltcoop/felt/util/string.js';
import * as lexer from 'es-module-lexer';

import {type GenContext, type RawGenResult} from './gen.js';
import {type SchemaGenModule} from './genModule.js';
import {toRootPath} from '../paths.js';
import {formatFile} from '../format/formatFile.js';
import {type Filesystem} from '../fs/filesystem.js';

export const genSchemas = async (
	mod: SchemaGenModule,
	{originId, fs}: GenContext,
): Promise<RawGenResult> => {
	const {imports, types} = await runSchemaGen(fs, mod);
	// TODO remove the eslint-disable line once we merge imports
	return `
    // generated by ${toRootPath(originId)}

    ${normalizeImports(imports).join(';')}

    ${types.join(';\n\n')}

    // generated by ${toRootPath(originId)}
  `;
};

export const runSchemaGen = async (
	fs: Filesystem,
	mod: SchemaGenModule,
): Promise<{imports: string[]; types: string[]}> => {
	const rawImports: string[] = [];
	const types: string[] = [];

	for (const identifier in mod) {
		const value = mod[identifier];
		if (!isSchema(value)) continue;

		// Compile the schema to TypeScript.
		const finalIdentifier = stripEnd(identifier, 'Schema'); // convenient to avoid name collisions
		const result = await compile(value, finalIdentifier, {bannerComment: '', format: false});
		types.push(result);

		// Traverse the schema and add any imports with `tsImport`.
		traverse(value, (key, value) => {
			if (key === 'tsImport') {
				if (typeof value === 'string') {
					rawImports.push(value);
				} else if (Array.isArray(value)) {
					rawImports.push(...value);
				}
			}
		});
	}

	const formattedImports = await formatFile(fs, 'virtualSchemaImports.ts', rawImports.join(';'));
	console.log('formattedImports', formattedImports);

	// TODO format and concatenate first?
	await lexer.init;
	// console.log('imports', imports);
	const [parsed] = lexer.parse(formattedImports);
	console.log('parsed', parsed);

	// TODO ignore dynamic imports
	// if (i.d > -1) {
	// }

	// for (const v of parsed) {
	// 	console.log('v.s, v.e);', imports[0].substring(v.s, v.e));
	// 	console.log('v.ss, v.ee);', imports[0].substring(v.ss, v.se));
	// }

	const imports = rawImports; // TODO

	return {imports, types};
};

// This is like the ajv `SchemaObject` except that it requires `$id`.
// We may want to loosen this restriction,
// but for now it seems like a convenient way to disambiguate schemas from other objects
// while ensuring they can be registered with ajv and referenced by other schemas.
export interface SchemaObject {
	$id: string;
	[key: string]: unknown;
}

const isSchema = (value: unknown): value is SchemaObject =>
	!!value && typeof value === 'object' && '$id' in value;

// TODO upstream to Felt?
/**
 * Performs a depth-first traversal of an object, calling `cb` for every key and value.
 * @param obj Any object with enumerable properties.
 * @param cb Receives the key and value for every enumerable property on `obj` and its descendents.
 * @returns
 */
const traverse = (obj: any, cb: (key: string, value: any) => void): void => {
	if (!obj || typeof obj !== 'object') return;
	for (const k in obj) {
		const v = obj[k];
		cb(k, v);
		traverse(v, cb);
	}
};

const normalizeImports = (imports: string[]): string[] =>
	Array.from(new Set(imports.map(normalizeImport)));

// TODO technically this should lex the imports using the TS compiler
// (or esbuild? does es-module-lexer work with the `type` imports?)
// and then ideally group imports to the same module into the same statement
const normalizeImport = (str: string): string => {
	str = stripEnd(str.trim(), ';');
	if (str.endsWith('"')) {
		const idx = str.indexOf('"');
		if (idx === str.length - 1) return str; // malformed, just pass it through
		return str.substring(0, idx) + "'" + str.substring(idx + 1, str.length - 1) + "'";
	} else {
		return str;
	}
};
