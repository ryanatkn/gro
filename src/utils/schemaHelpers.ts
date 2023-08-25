import type z from 'zod';
import {zodToJsonSchema} from 'zod-to-json-schema';

import type {JsonSchema} from './schema.js';

export const toJsonSchema = (t: z.ZodType<any, z.ZodTypeDef, any>, name: string): JsonSchema => {
	const schema = zodToJsonSchema(t, name);
	const args = (schema.definitions ? schema.definitions[name] : {}) as JsonSchema;
	args.$id = `/schemas/${name}`;
	return args;
};
