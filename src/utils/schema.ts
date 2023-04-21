import {traverse} from '@feltjs/util/object.js';
import type {JSONSchema} from '@ryanatkn/json-schema-to-typescript';
import type {ResolverOptions} from 'json-schema-ref-parser';
import type z from 'zod';
import {zodToJsonSchema} from 'zod-to-json-schema';

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
const toSchemaName = ($id: string) =>
	$id.startsWith('/schemas/') && $id.endsWith('.json') ? $id.substring(9, $id.length - 5) : $id;

/**
 * Mutates `schema` with `tsType` and `tsImport`, if appropriate.
 * @param schema
 */
export const inferSchemaTypes = (schema: VocabSchema): void => {
	traverse(schema, (key, value, obj) => {
		if (key === '$ref' && !('tsType' in obj)) {
			obj.tsType = toSchemaName(value);
		}
	});
};
