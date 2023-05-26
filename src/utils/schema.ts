import {traverse} from '@feltjs/util/object.js';
import type {JSONSchema} from '@ryanatkn/json-schema-to-typescript';
import type {ResolverOptions} from 'json-schema-ref-parser';
import type z from 'zod';
import {zodToJsonSchema} from 'zod-to-json-schema';
import type {GenContext} from '../gen/gen';

/**
 * Vocab schemas have `$anchor` instead of `$id`,
 * and are expected to be transformed or bundled with `bundleSchemas`.
 */
export interface VocabSchema extends JSONSchema {
	$anchor: string;
}

/**
 * Bundles an array of `VocabSchema`s into a single spec-compliant `JSONSchema`.
 * @param schemas
 * @param $id - @example 'https://app.felt.dev/schemas/vocab.json'
 * @param title - @example '@feltjs/felt-server vocab'
 * @param $schema - Defaults to version 2020-12.
 * @returns
 */
export const bundleSchemas = (
	schemas: VocabSchema[],
	title: string,
	$id: string,
	$schema = 'https://json-schema.org/draft/2020-12/schema',
): JSONSchema => {
	const schema: JSONSchema = {
		$id,
		$schema,
		title,
		$defs: structuredClone(schemas).sort((a, b) => a.$anchor.localeCompare(b.$anchor)),
	};
	return schema;
};

export const isVocabSchema = (value: unknown): value is VocabSchema =>
	!!value && typeof value === 'object' && '$id' in value;

export const toVocabSchema = (t: z.ZodType<any, z.ZodTypeDef, any>, name: string): VocabSchema => {
	const schema = zodToJsonSchema(t, name);
	const args = (schema.definitions ? schema.definitions[name] : {}) as VocabSchema;
	args.$anchor = '#' + name;
	return args;
};

// TODO BLOCK remove all /schemas/ and $id usage
// TODO BLOCK try to delete this resolver
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
const parseSchemaName = ($id: string): string | null =>
	$id.startsWith('/schemas/') && $id.endsWith('.json') ? $id.substring(9, $id.length - 5) : null;

// TODO make an option, is very hardcoded
const toSchemaImport = ($id: string, ctx: GenContext): string | null => {
	if (!$id.startsWith('/schemas/') || !$id.endsWith('.json')) return null;
	const name = $id.substring(9, $id.length - 5);
	return name in ctx.imports ? ctx.imports[name] : null;
};

/**
 * Mutates `schema` with `tsType` and `tsImport`, if appropriate.
 * @param schema
 */
export const inferSchemaTypes = (schema: VocabSchema, ctx: GenContext): void => {
	traverse(schema, (key, value, obj) => {
		if (key === '$ref') {
			if (!('tsType' in obj)) {
				const tsType = parseSchemaName(value);
				if (tsType) obj.tsType = tsType;
			}
			if (!('tsImport' in obj)) {
				const tsImport = toSchemaImport(value, ctx);
				if (tsImport) obj.tsImport = tsImport;
			}
		} else if (key === 'instanceof') {
			if (!('tsType' in obj)) obj.tsType = value;
		}
	});
};
