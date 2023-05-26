import type z from 'zod';
import {zodToJsonSchema} from 'zod-to-json-schema';

import type {VocabSchema} from './schema.js';

export const toVocabSchema = (t: z.ZodType<any, z.ZodTypeDef, any>, name: string): VocabSchema => {
	const schema = zodToJsonSchema(t, name);
	const args = (schema.definitions ? schema.definitions[name] : {}) as VocabSchema;
	args.$id = `/schemas/${name}`;
	return args;
};
