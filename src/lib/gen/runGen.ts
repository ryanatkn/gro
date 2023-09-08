import {red} from 'kleur/colors';
import {printError} from '@feltjs/util/print.js';
import {Timings} from '@feltjs/util/timings.js';
import type {Logger} from '@feltjs/util/log.js';
import {UnreachableError} from '@feltjs/util/error.js';
import type {Options as JsonSchemaToTypeScriptOptions} from '@ryanatkn/json-schema-to-typescript';
import {stripEnd} from '@feltjs/util/string.js';

import {
	GEN_SCHEMA_IDENTIFIER_SUFFIX,
	type GenModuleMeta,
	GEN_SCHEMA_PATH_SUFFIX,
} from './genModule.js';
import {
	type GenResults,
	type GenModuleResult,
	type GenContext,
	type GenModuleResultSuccess,
	type GenModuleResultFailure,
	to_gen_result,
	type RawGenResult,
} from './gen.js';
import type {Filesystem} from '../fs/filesystem.js';
import {print_path, source_id_to_base_path} from '../path/paths.js';
import {genSchemas, toSchemasFromModules} from './genSchemas.js';
import {to_json_schema_resolver} from '../util/schema.js';

export const GEN_NO_PROD_MESSAGE = 'gen runs only during development';

export const runGen = async (
	fs: Filesystem,
	genModules: GenModuleMeta[],
	log: Logger,
	format_file?: (fs: Filesystem, id: string, content: string) => Promise<string>,
): Promise<GenResults> => {
	let input_count = 0;
	let output_count = 0;
	const timings = new Timings();
	const timingForTotal = timings.start('total');
	const genSchemasOptions = toGenSchemasOptions(genModules);
	const imports = toGenContextImports(genModules);
	const results = await Promise.all(
		genModules.map(async (moduleMeta): Promise<GenModuleResult> => {
			input_count++;
			const {id} = moduleMeta;
			const timingForModule = timings.start(id);

			// Perform code generation by calling `gen` on the module.
			const genCtx: GenContext = {fs, origin_id: id, log, imports};
			let rawGenResult: RawGenResult;
			try {
				switch (moduleMeta.type) {
					case 'basic': {
						rawGenResult = await moduleMeta.mod.gen(genCtx);
						break;
					}
					case 'schema': {
						rawGenResult = await genSchemas(moduleMeta.mod, genCtx, genSchemasOptions);
						break;
					}
					default: {
						throw new UnreachableError(moduleMeta);
					}
				}
			} catch (err) {
				return {
					ok: false,
					id,
					error: err,
					reason: red(`Error generating ${print_path(id)}`),
					elapsed: timingForModule(),
				};
			}

			// Convert the module's return value to a normalized form.
			const genResult = to_gen_result(id, rawGenResult);

			// Format the files if needed.
			const files = format_file
				? await Promise.all(
						genResult.files.map(async (file) => {
							if (!file.format) return file;
							try {
								return {...file, content: await format_file(fs, file.id, file.content)};
							} catch (err) {
								log.error(
									red(`Error formatting ${print_path(file.id)} via ${print_path(id)}`),
									printError(err),
								);
								return file;
							}
						}),
				  )
				: genResult.files;

			output_count += files.length;
			return {
				ok: true,
				id,
				files,
				elapsed: timingForModule(),
			};
		}),
	);
	return {
		results,
		successes: results.filter((r) => r.ok) as GenModuleResultSuccess[],
		failures: results.filter((r) => !r.ok) as GenModuleResultFailure[],
		input_count,
		output_count,
		elapsed: timingForTotal(),
	};
};

const toGenSchemasOptions = (
	genModules: GenModuleMeta[],
): Partial<JsonSchemaToTypeScriptOptions> => {
	const schemas = toSchemasFromModules(genModules);
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

export const toGenContextImports = (genModules: GenModuleMeta[]): Record<string, string> => {
	const imports: Record<string, string> = {};
	for (const genModule of genModules) {
		if (genModule.type === 'schema') {
			const importPath = to_gen_import_path(genModule.id);
			for (const identifier of Object.keys(genModule.mod)) {
				const name = stripEnd(identifier, GEN_SCHEMA_IDENTIFIER_SUFFIX);
				imports[name] = `import type {${name}} from '${importPath}';`;
			}
		}
	}
	return imports;
};
