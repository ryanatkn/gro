import {type JSONSchema} from '@ryanatkn/json-schema-to-typescript';
import {ResolverError, type ResolverOptions} from 'json-schema-ref-parser';

export interface VocabSchema extends JSONSchema {
	$id: string;
}

export const isVocabSchema = (value: unknown): value is VocabSchema =>
	!!value && typeof value === 'object' && '$id' in value;

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
		if (!schema) {
			throw new ResolverError(new Error(`Unable to find schema: "${file.url}".`), file.url);
		}
		return JSON.stringify(schema);
	},
});
