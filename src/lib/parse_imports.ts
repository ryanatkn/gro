import {parseSync, type DynamicImport, type StaticImport} from 'oxc-parser'; // TODO see https://github.com/oxc-project/oxc/issues/7788 and https://github.com/oxc-project/oxc/blob/main/napi/parser/test/__snapshots__/esm.test.ts.snap
import type {Flavored} from '@ryanatkn/belt/types.js';

import type {Path_Id} from './path.js';
import {SVELTE_MATCHER} from './svelte_helpers.js';
import {JS_MATCHER, TS_MATCHER} from './constants.js';

export type Import_Specifier = Flavored<string, 'Import_Specifier'>;

const script_matcher = /<script.*?>(.*?)<\/script>/gimsu;

export const parse_imports = (
	id: Path_Id,
	contents: string,
	ignore_types = true,
): Array<Import_Specifier> => {
	const specifiers: Array<string> = [];

	// Helper function to process both static and dynamic imports
	const process_import = (import_node: StaticImport | DynamicImport, sourceCode: string) => {
		console.log(`import_node`, import_node);
		specifiers.push(
			sourceCode.substring(import_node.moduleRequest.start + 1, import_node.moduleRequest.end - 1),
		);
	};

	const is_svelte = SVELTE_MATCHER.test(id);

	const parse_from = (s: string): void => {
		const parsed = parseSync(is_svelte ? id + '.ts' : id, s);
		console.log(`parsed.module`, parsed.module);

		// Process static imports
		for (const p of parsed.module.staticImports) {
			process_import(p, s);
		}

		// Process dynamic imports
		for (const p of parsed.module.dynamicImports) {
			process_import(p, s);
		}
	};

	if (is_svelte) {
		const matches = contents.matchAll(script_matcher);
		for (const m of matches) {
			parse_from(m[1]);
		}
	} else if (TS_MATCHER.test(id) || JS_MATCHER.test(id)) {
		parse_from(contents);
	}

	return specifiers;
};
