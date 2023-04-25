import {
	compile,
	type Options as JsonSchemaToTypeScriptOptions,
} from '@ryanatkn/json-schema-to-typescript';
import {stripEnd} from '@feltjs/util/string.js';
import {traverse} from '@feltjs/util/object.js';

import type {GenContext, RawGenResult} from './gen.js';
import {SCHEMA_IDENTIFIER_SUFFIX, type GenModuleMeta, type SchemaGenModule} from './genModule.js';
import {renderTsHeaderAndFooter} from './helpers/ts.js';
import {normalizeTypeImports} from './helpers/typeImports.js';
import {infer_schema_types, isVocabSchema, type VocabSchema} from '../utils/schema.js';

export const genSchemas = async (
	mod: SchemaGenModule,
	ctx: GenContext,
	options: Partial<JsonSchemaToTypeScriptOptions>,
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
	options: Partial<JsonSchemaToTypeScriptOptions>,
): Promise<{imports: string[]; types: string[]}> => {
	const rawImports: string[] = [];
	const types: string[] = [];

	for (const {identifier, schema: originalSchema} of toSchemaInfoFromModule(mod)) {
		infer_schema_types(originalSchema, ctx); // process the schema, adding inferred data
		// `json-schema-to-typescript` mutates the schema, so clone first
		const schema = structuredClone(originalSchema);

		// Compile the schema to TypeScript.
		const finalIdentifier = stripEnd(identifier, SCHEMA_IDENTIFIER_SUFFIX); // convenient to avoid name collisions
		// eslint-disable-next-line no-await-in-loop
		const result = await compile(schema, finalIdentifier, {
			bannerComment: '',
			format: false,
			...options,
		});
		types.push(result);

		// Walk the original schema and add any imports with `tsImport`.
		// We don't walk `schema` because we don't include the types of expanded schema references.
		traverse(originalSchema, (key, v) => {
			if (key === 'tsImport') {
				if (typeof v === 'string') {
					rawImports.push(v);
				} else if (Array.isArray(v)) {
					rawImports.push(...v);
				}
			}
		});
	}

	const imports = await normalizeTypeImports(ctx.fs, rawImports, ctx.originId);

	return {imports, types};
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

const toSchemaInfoFromModule = (
	mod: SchemaGenModule,
): Array<{identifier: string; schema: VocabSchema}> => {
	const schemaInfo: Array<{identifier: string; schema: VocabSchema}> = [];
	for (const identifier in mod) {
		const value = mod[identifier];
		if (isVocabSchema(value)) schemaInfo.push({identifier, schema: value});
	}
	return schemaInfo;
};
