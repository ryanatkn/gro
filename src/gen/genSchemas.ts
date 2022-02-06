import {compile} from '@ryanatkn/json-schema-to-typescript';
import {stripEnd} from '@feltcoop/felt/util/string.js';

import {type GenContext, type RawGenResult} from './gen.js';
import {type SchemaGenModule} from './genModule.js';
import {renderTsHeaderAndFooter} from './helpers/ts.js';
import {normalizeTsImports} from './helpers/tsImport.js';

export const genSchemas = async (mod: SchemaGenModule, ctx: GenContext): Promise<RawGenResult> => {
	const {imports, types} = await runSchemaGen(ctx, mod);
	return renderTsHeaderAndFooter(
		ctx,
		`${imports.join('\n;\n')}

    ${types.join(';\n\n')}
  `,
	);
};

export const runSchemaGen = async (
	ctx: GenContext,
	mod: SchemaGenModule,
): Promise<{imports: string[]; types: string[]}> => {
	const rawImports: string[] = [];
	const types: string[] = [];

	for (const identifier in mod) {
		const value = mod[identifier];
		if (!isSchema(value)) continue;

		// Compile the schema to TypeScript.
		const finalIdentifier = stripEnd(identifier, 'Schema'); // convenient to avoid name collisions
		const result = await compile(value, finalIdentifier, {bannerComment: '', format: false}); // eslint-disable-line no-await-in-loop
		types.push(result);

		// Walk the entire schema and add any imports with `tsImport`.
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

	const imports = await normalizeTsImports(ctx.fs, rawImports, ctx.originId);

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
