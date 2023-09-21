import {red} from 'kleur/colors';
import {printError} from '@feltjs/util/print.js';
import type {Timings} from '@feltjs/util/timings.js';
import type {Logger} from '@feltjs/util/log.js';
import {UnreachableError} from '@feltjs/util/error.js';
import type {Options as JsonSchemaToTypeScriptOptions} from '@ryanatkn/json-schema-to-typescript';
import {stripEnd} from '@feltjs/util/string.js';

import {
	GEN_SCHEMA_IDENTIFIER_SUFFIX,
	type GenModuleMeta,
	GEN_SCHEMA_PATH_SUFFIX,
} from './gen_module.js';
import {
	type GenResults,
	type GenModuleResult,
	type GenContext,
	type GenModuleResultSuccess,
	type GenModuleResultFailure,
	to_gen_result,
	type RawGenResult,
} from './gen.js';
import {print_path, source_id_to_base_path} from './paths.js';
import {gen_schemas, to_schemas_from_modules} from './gen_schemas.js';
import {to_json_schema_resolver} from './schema.js';

export const GEN_NO_PROD_MESSAGE = 'gen runs only during development';

export const run_gen = async (
	gen_modules: GenModuleMeta[],
	log: Logger,
	timings: Timings,
	format_file?: (id: string, content: string) => Promise<string>,
): Promise<GenResults> => {
	let input_count = 0;
	let output_count = 0;
	const timing_for_run_gen = timings.start('run_gen');
	const gen_schemas_options = to_gen_schemas_options(gen_modules);
	const imports = to_gen_context_imports(gen_modules);
	const results = await Promise.all(
		gen_modules.map(async (module_meta): Promise<GenModuleResult> => {
			input_count++;
			const {id} = module_meta;
			const timing_for_module = timings.start(id);

			// Perform code generation by calling `gen` on the module.
			const gen_ctx: GenContext = {origin_id: id, log, imports};
			let raw_gen_result: RawGenResult;
			try {
				switch (module_meta.type) {
					case 'basic': {
						raw_gen_result = await module_meta.mod.gen(gen_ctx);
						break;
					}
					case 'schema': {
						raw_gen_result = await gen_schemas(module_meta.mod, gen_ctx, gen_schemas_options);
						break;
					}
					default: {
						throw new UnreachableError(module_meta);
					}
				}
			} catch (err) {
				return {
					ok: false,
					id,
					error: err,
					reason: red(`Error generating ${print_path(id)}`),
					elapsed: timing_for_module(),
				};
			}

			// Convert the module's return value to a normalized form.
			const gen_result = to_gen_result(id, raw_gen_result);

			// Format the files if needed.
			const files = format_file
				? await Promise.all(
						gen_result.files.map(async (file) => {
							if (!file.format) return file;
							try {
								return {...file, content: await format_file(file.id, file.content)};
							} catch (err) {
								log.error(
									red(`Error formatting ${print_path(file.id)} via ${print_path(id)}`),
									printError(err),
								);
								return file;
							}
						}),
				  )
				: gen_result.files;

			output_count += files.length;
			return {
				ok: true,
				id,
				files,
				elapsed: timing_for_module(),
			};
		}),
	);
	return {
		results,
		successes: results.filter((r) => r.ok) as GenModuleResultSuccess[],
		failures: results.filter((r) => !r.ok) as GenModuleResultFailure[],
		input_count,
		output_count,
		elapsed: timing_for_run_gen(),
	};
};

const to_gen_schemas_options = (
	gen_modules: GenModuleMeta[],
): Partial<JsonSchemaToTypeScriptOptions> => {
	const schemas = to_schemas_from_modules(gen_modules);
	return {
		$refOptions: {
			resolve: {
				http: false, // disable web resolution
				vocab: to_json_schema_resolver(schemas),
			},
		},
	};
};

// TODO configurable
export const to_gen_import_path = (id: string): string =>
	'$' + stripEnd(source_id_to_base_path(id), GEN_SCHEMA_PATH_SUFFIX);

export const to_gen_context_imports = (gen_modules: GenModuleMeta[]): Record<string, string> => {
	const imports: Record<string, string> = {};
	for (const gen_module of gen_modules) {
		if (gen_module.type === 'schema') {
			const importPath = to_gen_import_path(gen_module.id);
			for (const identifier of Object.keys(gen_module.mod)) {
				const name = stripEnd(identifier, GEN_SCHEMA_IDENTIFIER_SUFFIX);
				imports[name] = `import type {${name}} from '${importPath}';`;
			}
		}
	}
	return imports;
};
