import ts from 'typescript';
import {extname} from 'node:path';
import type {Flavored} from '@ryanatkn/belt/types.js';
import type {Logger} from '@ryanatkn/belt/log.js';
import type {DeclarationKind} from '@ryanatkn/belt/source_json.js';
import type {PathId} from '@ryanatkn/belt/path.js';

import {TS_MATCHER} from './constants.ts';
import {ParseExportsContext} from './parse_exports_context.ts';

export interface Declaration {
	name: string;
	kind: DeclarationKind | null;
}

export type ExportDeclaration = Flavored<Declaration, 'ExportDeclaration'>;

/**
 * Parse exports from a file based on its file type and content.
 */
export const parse_exports = (
	id: PathId,
	program?: ts.Program,
	declarations: Array<ExportDeclaration> = [],
	log?: Logger,
): Array<ExportDeclaration> => {
	// First, infer declarations based on file extension
	infer_declarations_from_file_type(id, declarations);

	// For TypeScript files with program, perform detailed export analysis
	if (TS_MATCHER.test(id) && program) {
		const source_file = program.getSourceFile(id);
		if (!source_file) return declarations;

		const checker = program.getTypeChecker();

		// Get the exports of the source file (module)
		const symbol = checker.getSymbolAtLocation(source_file);
		if (!symbol) return declarations;

		// Get the module exports
		const exports = checker.getExportsOfModule(symbol);

		// Process TypeScript declarations
		const export_context = new ParseExportsContext(program, log);
		export_context.analyze_source_file(source_file);
		export_context.process_exports(source_file, exports, declarations);
	}

	return declarations;
};

// TODO temporary until proper type inference
export const infer_declarations_from_file_type = (
	file_path: PathId,
	declarations: Array<ExportDeclaration> = [],
): Array<ExportDeclaration> => {
	const extension = extname(file_path).toLowerCase();

	switch (extension) {
		case '.svelte': {
			declarations.push({
				name: 'default',
				kind: 'component',
			});
			break;
		}
		case '.css': {
			declarations.push({
				name: 'default',
				kind: 'css',
			});
			break;
		}
		case '.json': {
			declarations.push({
				name: 'default',
				kind: 'json',
			});
			break;
		}
	}

	return declarations;
};

/**
 * Process TypeScript exports, identifying their kinds.
 */
export const process_ts_exports = (
	source_file: ts.SourceFile,
	program: ts.Program,
	exports: Array<ts.Symbol>,
	declarations: Array<ExportDeclaration> = [],
	log?: Logger,
): Array<ExportDeclaration> => {
	const export_context = new ParseExportsContext(program, log);
	export_context.analyze_source_file(source_file);
	return export_context.process_exports(source_file, exports, declarations);
};
