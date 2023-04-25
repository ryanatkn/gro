import {traverse} from '@feltjs/util/object.js';
import type {JSONSchema} from '@ryanatkn/json-schema-to-typescript';
import type {ResolverOptions} from 'json-schema-ref-parser';
import type z from 'zod';
import {zodToJsonSchema} from 'zod-to-json-schema';
import type {GenContext} from '../gen/gen';

export interface VocabSchema extends JSONSchema {
	$id: string;
}

export const isVocabSchema = (value: unknown): value is VocabSchema =>
	!!value && typeof value === 'object' && '$id' in value;

export const toVocabSchema = (t: z.ZodType<any, z.ZodTypeDef, any>, name: string): VocabSchema => {
	const schema = zodToJsonSchema(t, name);
	const args = (schema.definitions ? schema.definitions[name] : {}) as VocabSchema;
	args.$id = `/schemas/${name}.json`;
	return args;
};

/**
 * Creates a custom resolver for `VocabSchema`s supporting paths like "/schemas/Something.json".
 * @param schemas
 * @returns
 */
export const toVocabSchemaResolver = (schemas: VocabSchema[]): ResolverOptions => ({
	order: 1,
	canRead: true,
	read: (file) => {
		const schema = schemas.find((s) => s.$id === file.url);
		if (!schema) throw new Error(`Unable to find schema: "${file.url}".`);
		return JSON.stringify(schema);
	},
});

// TODO do this more robustly (handle `/`?)
const parse_schema_name = ($id: string): string | null =>
	$id.startsWith('/schemas/') && $id.endsWith('.json') ? $id.substring(9, $id.length - 5) : null;

// TODO make an option, is very hardcoded
const to_schema_import = ($id: string, ctx: GenContext): string | null => {
	if (!$id.startsWith('/schemas/') || !$id.endsWith('.json')) return null;
	const name = $id.substring(9, $id.length - 5);
	return name in ctx.imports ? ctx.imports[name] : null;
};

/**
 * Mutates `schema` with `tsType` and `tsImport`, if appropriate.
 * @param schema
 */
export const infer_schema_types = (schema: VocabSchema, ctx: GenContext): void => {
	traverse(schema, (key, value, obj) => {
		if (key === '$ref') {
			if (!('tsType' in obj)) {
				const tsType = parse_schema_name(value);
				if (tsType) obj.tsType = tsType;
			}
			if (!('tsImport' in obj)) {
				const tsImport = to_schema_import(value, ctx);
				if (tsImport) obj.tsImport = tsImport;
			}
		} else if (key === 'instanceof') {
			if (!('tsType' in obj)) obj.tsType = value;
		}
	});
};
