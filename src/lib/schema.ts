import {traverse} from '@grogarden/util/object.js';
import type {JSONSchema} from '@ryanatkn/json-schema-to-typescript';
import type {ResolverOptions} from 'json-schema-ref-parser';

import type {GenContext} from './gen.js';

export interface JsonSchema extends JSONSchema {
	$id: string;
}

/**
 * Bundles an array of `JsonSchema`s into a single spec-compliant `JSONSchema`
 * with the given `$id` and `title`.
 * @see https://json-schema.org/draft/2020-12/json-schema-core.html#name-bundling
 * @see https://json-schema.org/understanding-json-schema/structuring.html#bundling
 * @param schemas
 * @param $id - @example '/schemas/vocab.json'
 * @param title - @example '@feltjs/felt-server vocab'
 * @param $schema - Defaults to version 2020-12.
 * @returns
 */
export const bundle_schemas = (
	schemas: JsonSchema[],
	$id: string,
	title: string | undefined = undefined,
	$schema = 'https://json-schema.org/draft/2020-12/schema',
): JSONSchema => {
	const schema: JSONSchema = {$id, $schema};
	if (title) schema.title = title;
	schema.$defs = structuredClone(schemas)
		.sort((a, b) => a.$id.localeCompare(b.$id))
		.reduce(
			($defs, schema) => {
				const name = parse_schema_name(schema.$id);
				if (!name) throw Error(`Unable to parse schema name: "${schema.$id}"`);
				$defs[name] = schema;
				return $defs;
			},
			{} as Record<string, JsonSchema>,
		);
	return schema;
};

export const is_json_schema = (value: unknown): value is JsonSchema =>
	!!value && typeof value === 'object' && '$id' in value;

/**
 * Creates a custom resolver for `JsonSchema`s supporting refs like `/schemas/Something`.
 * @param schemas
 * @returns
 */
export const to_json_schema_resolver = (schemas: JsonSchema[]): ResolverOptions => ({
	order: 1,
	canRead: true,
	read: (file) => {
		const schema = schemas.find((s) => s.$id === file.url);
		if (!schema) throw new Error(`Unable to find schema: "${file.url}".`);
		return JSON.stringify(schema);
	},
});

/**
 * Mutates `schema` with `tsType` and `tsImport`, if appropriate.
 * @param schema
 */
export const infer_schema_types = (schema: JsonSchema, ctx: GenContext): void => {
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

const VOCAB_SCHEMA_ID_MATCHER = /^\/schemas\/(\w+)$/u;

export const parse_schema_name = ($id: string): string | null =>
	VOCAB_SCHEMA_ID_MATCHER.exec($id)?.[1] || null;

// TODO make an option, is very hardcoded
const to_schema_import = ($id: string, ctx: GenContext): string | null => {
	const name = parse_schema_name($id);
	return name && name in ctx.imports ? ctx.imports[name] : null;
};
