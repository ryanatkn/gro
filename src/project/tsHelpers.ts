import ts from 'typescript';
import {dirname} from 'path';

import {black, bgRed} from '../colors/terminal.js';
import {Logger} from '../utils/log.js';

// confusingly, TypeScript doesn't seem to be a good type for this
export interface TsConfig {
	// the compiler options after `ts.convertCompilerOptionsFromJson`
	compilerOptions?: ts.CompilerOptions;
	// these are the raw json compiler options
	rawCompilerOptions?: object;
	include?: string[];
	exclude?: string[];
	files?: string[];
	extends?: string;
	references?: {path: string}[];
	compileOnSave?: boolean;
}

export const loadTsconfig = (
	log: Logger,
	tsconfigPath?: string,
	basePath = tsconfigPath ? dirname(tsconfigPath) : process.cwd(),
): TsConfig => {
	if (!tsconfigPath) {
		const searchPath = tsconfigPath || basePath;
		tsconfigPath = ts.findConfigFile(searchPath, ts.sys.fileExists);
		if (!tsconfigPath) {
			throw Error(`Could not locate tsconfig at ${searchPath}`);
		}
	}

	const readResult = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
	if (readResult.error) logTsDiagnostics([readResult.error], log);

	const config: TsConfig = readResult.config;
	if (!config) throw Error(`Unable to read tsconfig from ${tsconfigPath}`);

	const rawCompilerOptions = config.compilerOptions;
	const convertResult = ts.convertCompilerOptionsFromJson(
		rawCompilerOptions,
		basePath,
	);
	if (convertResult.errors) logTsDiagnostics(convertResult.errors, log);

	return {
		...config,
		compilerOptions: convertResult.options,
		rawCompilerOptions,
	};
};

export const logTsDiagnostics = (
	diagnostics: ReadonlyArray<ts.Diagnostic>,
	{error}: Logger,
): void => {
	const count = diagnostics.length;
	if (!count) return;
	const msg = ts.formatDiagnosticsWithColorAndContext(
		diagnostics,
		createFormatDiagnosticsHost(),
	);
	error(black(bgRed(` ${count} item${count === 1 ? '' : 's'}`)) + '\n' + msg);
};

const createFormatDiagnosticsHost = (): ts.FormatDiagnosticsHost => {
	return {
		getCurrentDirectory(): string {
			return ts.sys.getCurrentDirectory();
		},
		getCanonicalFileName(fileName: string): string {
			return fileName;
			// TODO is lowercasing really necessary?
			// return ts.sys.useCaseSensitiveFileNames
			// 	? fileName
			// 	: fileName.toLowerCase();
		},
		getNewLine(): string {
			return ts.sys.newLine;
		},
	};
};
