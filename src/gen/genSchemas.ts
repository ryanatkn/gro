import {compile, type Options} from '@ryanatkn/json-schema-to-typescript';
import {stripEnd} from '@feltcoop/felt/util/string.js';

import {type GenContext, type RawGenResult} from './gen.js';
import {type GenModuleMeta, type SchemaGenModule} from './genModule.js';
import {renderTsHeaderAndFooter} from './helpers/ts.js';
import {normalizeTsImports} from './helpers/tsImport.js';
import {isVocabSchema, type VocabSchema} from '../utils/schema.js';

export const genSchemas = async (
	mod: SchemaGenModule,
	ctx: GenContext,
	options: Partial<Options>,
): Promise<RawGenResult> => {
	const {imports, types} = await runSchemaGen(ctx, mod, options);
	return renderTsHeaderAndFooter(
		ctx,
		`${imports.join('\n;\n')}

    ${types.join(';\n\n')}
  `,
	);
};

const runSchemaGen = async (
	ctx: GenContext,
	mod: SchemaGenModule,
	options: Partial<Options>,
): Promise<{imports: string[]; types: string[]}> => {
	const rawImports: string[] = [];
	const types: string[] = [];

	for (const {identifier, schema: originalSchema} of toSchemaInfoFromModule(mod)) {
		// `json-schema-to-typescript` adds an `id` property,
		// which causes `ajv` to fail to compile,
		// so instead of adding `id` as an `ajv` keyword we shallow clone the schema.
		const schema = {...originalSchema};

		// Compile the schema to TypeScript.
		const finalIdentifier = stripEnd(identifier, 'Schema'); // convenient to avoid name collisions
		// eslint-disable-next-line no-await-in-loop
		const result = await compile(schema, finalIdentifier, {
			bannerComment: '',
			format: false,
			...options,
		});
		types.push(result);

		// Walk the entire schema and add any imports with `tsImport`.
		traverse(schema, (key, v) => {
			if (key === 'tsImport') {
				if (typeof v === 'string') {
					rawImports.push(v);
				} else if (Array.isArray(v)) {
					rawImports.push(...v);
				}
			}
		});
	}

	const imports = await normalizeTsImports(ctx.fs, rawImports, ctx.originId);

	return {imports, types};
};

// TODO upstream to Felt?
/**
 * Performs a depth-first traversal of an object's enumerable properties,
 * calling `cb` for every key and value.
 * @param obj Any object with enumerable properties.
 * @param cb Receives the key and value for every enumerable property on `obj` and its descendents.
 * @returns
 */
const traverse = (obj: any, cb: (key: string, value: any, obj: any) => void): void => {
	if (!obj || typeof obj !== 'object') return;
	for (const k in obj) {
		const v = obj[k];
		cb(k, v, obj);
		traverse(v, cb);
	}
};

export const toSchemasFromModules = (genModules: GenModuleMeta[]): VocabSchema[] => {
	const schemas: VocabSchema[] = [];
	for (const genModule of genModules) {
		if (genModule.type !== 'schema') continue;
		for (const schemaInfo of toSchemaInfoFromModule(genModule.mod)) {
			schemas.push(schemaInfo.schema);
		}
	}
	return schemas;
};

export const toSchemaInfoFromModule = (
	mod: SchemaGenModule,
): Array<{identifier: string; schema: VocabSchema}> => {
	const schemaInfo: Array<{identifier: string; schema: VocabSchema}> = [];
	for (const identifier in mod) {
		const value = mod[identifier];
		if (isVocabSchema(value)) schemaInfo.push({identifier, schema: value});
	}
	return schemaInfo;
};
