import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import ts from 'typescript';

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
): {
	source_file: ts.SourceFile;
	checker: ts.TypeChecker;
	exports: Array<ts.Symbol>;
} => {
	// Create a virtual file path for testing
	const file_path = join(dir, 'virtual_test_file.ts');

	// Create a virtual compiler host
	const host = ts.createCompilerHost({});
	const original_get_source_file = host.getSourceFile.bind(host);

	// Override getSourceFile to return our test file
	host.getSourceFile = (fileName: string, languageVersion: ts.ScriptTarget) => {
		if (fileName === file_path) {
			return ts.createSourceFile(fileName, source_code, languageVersion);
		}
		return original_get_source_file(fileName, languageVersion);
	};

	// Create a program with our virtual file
	const program = ts.createProgram(
		[file_path],
		{
			target: ts.ScriptTarget.ESNext,
			module: ts.ModuleKind.ESNext,
			moduleResolution: ts.ModuleResolutionKind.NodeNext,
		},
		host,
	);

	const source_file = program.getSourceFile(file_path)!;
	const checker = program.getTypeChecker();

	// Get the exports from the source file
	const symbol = checker.getSymbolAtLocation(source_file);
	const exports = symbol ? checker.getExportsOfModule(symbol) : [];

	return {source_file, checker, exports};
};
