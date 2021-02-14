import ts from 'typescript';
import type {JscTarget} from '@swc/core';
import {join, dirname, resolve} from 'path';

import {black, bgRed} from '../colors/terminal.js';
import {Logger} from '../utils/log.js';

export type EcmaScriptTarget = JscTarget;

export const DEFAULT_ECMA_SCRIPT_TARGET: EcmaScriptTarget = 'es2019';

export const toEcmaScriptTarget = (target: ts.ScriptTarget | undefined): EcmaScriptTarget => {
	switch (target) {
		case 0: // ES3 = 0,
			return 'es3';
		case 1: // ES5 = 1,
			return 'es5';
		case 2: // ES2015 = 2,
			return 'es2015';
		case 3: // ES2016 = 3,
			return 'es2016';
		case 4: // ES2017 = 4,
			return 'es2017';
		case 5: // ES2018 = 5,
			return 'es2018';
		case 6: // ES2019 = 6,
			return 'es2019';
		// ES2020 = 7,
		// ESNext = 99,
		// JSON = 100,
		// Latest = 99
		default:
			return DEFAULT_ECMA_SCRIPT_TARGET;
	}
};

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

const tsconfigCache: Map<string, TsConfig> = new Map();

// TODO This is pretty slow.
// (10ms last I measured, might seem small but you can do a LOT of work in 10ms and it's *blocking*)
// Caching helps but maybe we should just import the JSON, at least when only using swc?
// Also we don't currently watch for changes, but could eventually,
// way down the line when that's the biggest issue to address!
export const loadTsconfig = (
	log: Logger,
	tsconfigPath?: string,
	basePath = tsconfigPath ? dirname(tsconfigPath) : process.cwd(),
	forceReload = false,
): TsConfig => {
	// create a canonical cache key that can accept multiple variations
	const cacheKey = join(resolve(basePath), tsconfigPath || 'tsconfig.json');
	if (!forceReload) {
		const cachedTsconfig = tsconfigCache.get(cacheKey);
		if (cachedTsconfig) return cachedTsconfig;
	}

	if (!tsconfigPath) {
		const searchPath = tsconfigPath || basePath;
		tsconfigPath = ts.findConfigFile(searchPath, ts.sys.fileExists);
		if (!tsconfigPath) {
			throw Error(`Could not locate tsconfig at ${searchPath}`);
		}
	}

	const readResult = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
	if (readResult.error) logTsDiagnostics([readResult.error], log);

	const tsconfig: TsConfig = readResult.config;
	if (!tsconfig) throw Error(`Unable to read tsconfig from ${tsconfigPath}`);

	const rawCompilerOptions = tsconfig.compilerOptions;
	const convertResult = ts.convertCompilerOptionsFromJson(rawCompilerOptions, basePath);
	if (convertResult.errors) logTsDiagnostics(convertResult.errors, log);

	// the TypeScript API generally uses the converted options,
	// but sometimes it's better to have the plain JSON versions so we store both
	tsconfig.compilerOptions = convertResult.options;
	tsconfig.rawCompilerOptions = rawCompilerOptions;
	tsconfigCache.set(cacheKey, tsconfig);

	return tsconfig;
};

export const logTsDiagnostics = (diagnostics: ReadonlyArray<ts.Diagnostic>, log: Logger): void => {
	const count = diagnostics.length;
	if (!count) return;
	const msg = ts.formatDiagnosticsWithColorAndContext(diagnostics, createFormatDiagnosticsHost());
	log.error(black(bgRed(` ${count} item${count === 1 ? '' : 's'}`)) + '\n' + msg);
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
