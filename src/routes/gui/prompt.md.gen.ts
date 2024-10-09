import type {Gen} from '@ryanatkn/gro/gen.js';
import {spawn_out} from '@ryanatkn/belt/process.js';
import {readFileSync, writeFileSync} from 'node:fs';

import {Prompt_Builder} from '$lib/prompt.js';

export const gen: Gen = async () => {
	const b = new Prompt_Builder();

	const files = [
		'src/lib/prompt_intro.md',
		'src/lib/prompt_styleguide.md', // TODO BLOCK move this to a shared lib
		'src/lib/z.ts',
		'src/lib/helpers.ts',
		'src/lib/test_cases.ts',
		'src/lib/z.test.ts',
		// 'src/lib/z_to_ts.ts',
		// 'src/lib/z_to_ts.test.ts',
		// 'src/lib/z_to_imperative_parser.ts',
		// 'src/lib/z_to_imperative_parser.test.ts',
		// 'src/lib/z_to_imperative_serializer.ts',
		// 'src/lib/z_to_imperative_serializer.test.ts',
	];

	for (const file of files) {
		b.add_file(file);
	}

	// TODO write `tsconfig.json` before and after this
	const undo_tsconfig_change = temp_change_file('tsconfig.json', (tsconfig_contents) => {
		// replace  `"src/**/*.ts"` with `"src/**/z.ts",`
		return tsconfig_contents.replace('"src/**/*.ts"', '"src/**/z.ts"');
	});
	const typecheck_result = await spawn_out('gro', ['typecheck']);
	if (typecheck_result.stdout) {
		const output = typecheck_result.stdout;
		if (!output.includes('svelte-check found 0 errors and 0 warnings')) {
			b.add_text(output, 'stdout from typecheck task');
		}
	}
	undo_tsconfig_change();

	const test_result = await spawn_out('gro', ['test', 'z.test']); // TODO better way to omit/pick files - also need to handle that with typecheck above (or does svelte-check support it?)
	if (test_result.stderr) {
		b.add_text(test_result.stderr, 'stderr from test task');
	}
	if (test_result.stdout) {
		b.add_text(test_result.stdout, 'stdout from test task');
	}

	return b.toString();
};

// TODO move, to `prompt.ts` or `prompt_helpers.ts` or something more generic?
const temp_change_file = (path: string, change: (contents: string) => string): (() => void) => {
	const original_contents = readFileSync(path, 'utf8');
	const updated_contents = change(original_contents);
	writeFileSync(path, updated_contents);
	return () => {
		writeFileSync(path, original_contents);
	};
};
