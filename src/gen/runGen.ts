import {red} from 'kleur/colors';
import {printError} from '@feltjs/util/print.js';
import {Timings} from '@feltjs/util/timings.js';
import type {Logger} from '@feltjs/util/log.js';
import {UnreachableError} from '@feltjs/util/error.js';
import type {Options as JsonSchemaToTypeScriptOptions} from '@ryanatkn/json-schema-to-typescript';
import {stripEnd} from '@feltjs/util/string.js';

import {SCHEMA_IDENTIFIER_SUFFIX, type GenModuleMeta} from './genModule.js';
import {
	type GenResults,
	type GenModuleResult,
	type GenContext,
	type GenModuleResultSuccess,
	type GenModuleResultFailure,
	toGenResult,
	type RawGenResult,
} from './gen.js';
import type {Filesystem} from '../fs/filesystem.js';
import {printPath, sourceIdToBasePath} from '../paths.js';
import {genSchemas, toSchemasFromModules} from './genSchemas.js';
import {toVocabSchemaResolver} from '../utils/schema.js';

export const runGen = async (
	fs: Filesystem,
	genModules: GenModuleMeta[],
	log: Logger,
	formatFile?: (fs: Filesystem, id: string, content: string) => Promise<string>,
): Promise<GenResults> => {
	let inputCount = 0;
	let outputCount = 0;
	const timings = new Timings();
	const timingForTotal = timings.start('total');
	const genSchemasOptions = toGenSchemasOptions(genModules);
	console.log(`genModules`, genModules);
	const imports = toGenContextImports(genModules);
	const results = await Promise.all(
		genModules.map(async (moduleMeta): Promise<GenModuleResult> => {
			inputCount++;
			const {id} = moduleMeta;
			const timingForModule = timings.start(id);

			// Perform code generation by calling `gen` on the module.
			const genCtx: GenContext = {fs, originId: id, log, imports};
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
					reason: red(`Error generating ${printPath(id)}`),
					elapsed: timingForModule(),
				};
			}

			// Convert the module's return value to a normalized form.
			const genResult = toGenResult(id, rawGenResult);

			// Format the files if needed.
			const files = formatFile
				? await Promise.all(
						genResult.files.map(async (file) => {
							if (!file.format) return file;
							try {
								return {...file, content: await formatFile(fs, file.id, file.content)};
							} catch (err) {
								log.error(
									red(`Error formatting ${printPath(file.id)} via ${printPath(id)}`),
									printError(err),
								);
								return file;
							}
						}),
				  )
				: genResult.files;

			outputCount += files.length;
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
		inputCount,
		outputCount,
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
				vocab: toVocabSchemaResolver(schemas),
			},
		},
	};
};

// TODO configurable
const toImportPath = (id: string): string => '$' + stripEnd(sourceIdToBasePath(id), '.schema.ts');

const toGenContextImports = (genModules: GenModuleMeta[]): Record<string, string> => {
	const imports: Record<string, string> = {};
	for (const genModule of genModules) {
		if (genModule.type === 'schema') {
			const importPath = toImportPath(genModule.id);
			for (const identifier of Object.keys(genModule.mod)) {
				const name = stripEnd(identifier, SCHEMA_IDENTIFIER_SUFFIX);
				imports[name] = `import type {${name}} from '${importPath}';`;
			}
		}
	}
	return imports;
};
