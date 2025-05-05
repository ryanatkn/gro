import ts from 'typescript';
import {extname} from 'node:path';
import type {Flavored} from '@ryanatkn/belt/types.js';

import type {Path_Id} from './path.ts';
import {TS_MATCHER} from './constants.ts';
import {Parse_Exports_Context} from './parse_exports_context.ts';
import type {Logger} from '@ryanatkn/belt/log.js';

export type Declaration_Kind =
	| 'type'
	| 'function'
	| 'variable' // TODO maybe expand this to have literals/primitives?
	| 'class'
	| 'component'
	| 'json'
	| 'css';

export interface Declaration {
	name: string;
	kind: Declaration_Kind | null;
}

export type Export_Declaration = Flavored<Declaration, 'Export_Declaration'>;

/**
 * Parse exports from a file based on its file type and content.
 */
export const parse_exports = (
	id: Path_Id,
	program?: ts.Program,
	declarations: Array<Export_Declaration> = [],
	log?: Logger,
): Array<Export_Declaration> => {
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
		const export_context = new Parse_Exports_Context(program, log);
		export_context.analyze_source_file(source_file);
		export_context.process_exports(source_file, exports, declarations);
	}

	return declarations;
};

// TODO temporary until proper type inference
export const infer_declarations_from_file_type = (
	file_path: Path_Id,
	declarations: Array<Export_Declaration> = [],
): Array<Export_Declaration> => {
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
	declarations: Array<Export_Declaration> = [],
	log?: Logger,
): Array<Export_Declaration> => {
	const export_context = new Parse_Exports_Context(program, log);
	export_context.analyze_source_file(source_file);
	return export_context.process_exports(source_file, exports, declarations);
};
