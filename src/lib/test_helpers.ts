import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import ts from 'typescript';

export const TEST_TIMEOUT_MD = 20_000;

export const SOME_PUBLIC_ENV_VAR_NAME = 'PUBLIC_SOME_PUBLIC_ENV_VAR';
export const SOME_PUBLIC_ENV_VAR_VALUE = 'SOME_PUBLIC_ENV_VAR';
const name_equals = SOME_PUBLIC_ENV_VAR_NAME + '=';
const line = name_equals + SOME_PUBLIC_ENV_VAR_VALUE;

let inited = false;

/**
 * Hacky global helper to init the test env.
 *
 * @returns boolean indicating if the env file was created or not
 */
export const init_test_env = (dir = process.cwd(), env_filename = '.env'): boolean => {
	if (inited) return false;
	inited = true;

	const env_file = join(dir, env_filename);

	if (!existsSync(env_file)) {
		writeFileSync(env_file, line + '\n', 'utf8');
		return true;
	}

	const contents = readFileSync(env_file, 'utf8');
	const lines = contents.split('\n');
	if (lines.includes(line)) {
		return false; // already exists
	}

	let new_contents: string;
	const found_index = lines.findIndex((l) => l.startsWith(name_equals));
	if (found_index === -1) {
		// if the line does not exist, add it
		new_contents = contents + (contents.endsWith('\n') ? '' : '\n') + line + '\n';
	} else {
		// if the line exists but with a different value, replace it
		new_contents = contents.replace(new RegExp(`${SOME_PUBLIC_ENV_VAR_NAME}=.*`), line);
	}
	writeFileSync(env_file, new_contents, 'utf8');

	return true;
};

/**
 * Creates a TypeScript environment for testing.
 * Change to `typescript-go` when it's more ready.
 * @see https://github.com/microsoft/typescript-go?tab=readme-ov-file#what-works-so-far
 */
export const create_ts_test_env = (
	source_code: string,
	dir: string = process.cwd(),
	virtual_files: Record<string, string> = {},
): {
	source_file: ts.SourceFile;
	checker: ts.TypeChecker;
	program: ts.Program;
	exports: Array<ts.Symbol>;
} => {
	// Create a virtual file path for testing
	const file_path = join(dir, 'virtual_test_file.ts');

	// Create a compiler host with custom module resolution
	const host = ts.createCompilerHost({});
	const original_get_source_file = host.getSourceFile.bind(host);

	// Override getSourceFile to return our test files
	host.getSourceFile = (fileName: string, languageVersion: ts.ScriptTarget) => {
		if (fileName === file_path) {
			return ts.createSourceFile(fileName, source_code, languageVersion);
		}

		// Check if we have a virtual file for this path
		for (const [virtual_path, content] of Object.entries(virtual_files)) {
			const full_path = join(dir, virtual_path);
			if (fileName === full_path) {
				return ts.createSourceFile(fileName, content, languageVersion);
			}
		}

		return original_get_source_file(fileName, languageVersion);
	};

	// TODO simplify?
	// Add custom module resolution using resolveModuleNameLiterals
	host.resolveModuleNameLiterals = (
		module_literals: ReadonlyArray<ts.StringLiteralLike>,
		containing_file: string,
		_redirected_reference: ts.ResolvedProjectReference | undefined,
		options: ts.CompilerOptions,
	): Array<ts.ResolvedModuleWithFailedLookupLocations> => {
		return module_literals.map((module_literal) => {
			const module_name = module_literal.text;

			// Handle relative imports that might be in our virtual files
			if (module_name.startsWith('./') || module_name.startsWith('../')) {
				const module_path = join(containing_file, '..', module_name);

				// Normalize the path handling for the virtual files
				for (const virtual_path of Object.keys(virtual_files)) {
					const full_path = join(dir, virtual_path);
					const normalized_module_path = module_path.replace(/\.ts$/, '') + '.ts';

					if (normalized_module_path === full_path) {
						return {
							resolvedModule: {
								resolvedFileName: full_path,
								isExternalLibraryImport: false,
								extension: ts.Extension.Ts,
							},
						};
					}
				}
			}

			// If it's our main file
			if (join(dir, module_name) === file_path) {
				return {
					resolvedModule: {
						resolvedFileName: file_path,
						isExternalLibraryImport: false,
						extension: ts.Extension.Ts,
					},
				};
			}

			// For non-virtual modules, try standard resolution
			return ts.resolveModuleName(module_name, containing_file, options, host);
		});
	};

	// Include all virtual files in the program files list
	const program_files = [file_path, ...Object.keys(virtual_files).map((path) => join(dir, path))];

	// TODO get from tsconfig?
	// Create program options
	const compiler_options: ts.CompilerOptions = {
		target: ts.ScriptTarget.ESNext,
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.NodeNext,
		verbatimModuleSyntax: true,
		isolatedModules: true,
	};

	// Create a program with our virtual files
	const program = ts.createProgram(program_files, compiler_options, host);

	const source_file = program.getSourceFile(file_path)!;
	const checker = program.getTypeChecker();

	// Get the exports from the source file
	const symbol = checker.getSymbolAtLocation(source_file);
	const exports = symbol ? checker.getExportsOfModule(symbol) : [];

	return {source_file, checker, program, exports};
};
