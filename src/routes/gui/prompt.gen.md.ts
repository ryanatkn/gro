import type {Gen} from '@ryanatkn/gro/gen.js';
import {spawn_out} from '@ryanatkn/belt/process.js';

import {Prompt_Builder} from '$lib/prompt.js';

export const gen: Gen = async () => {
	const b = new Prompt_Builder();

	// TODO helper to add
	const files = [
		import.meta.dirname + '/prompt_intro.md',
		import.meta.dirname + '/prompt_styleguide.md', // TODO BLOCK move this to a shared lib
		// 'src/lib/a.ts',
	];

	for (const file of files) {
		b.add_file(file);
	}

	// TODO think about how this could be shared across genfiles, maybe on the `ctx`?
	const typecheck_result = await spawn_out('gro', ['typecheck']);
	if (typecheck_result.stdout) {
		const output = typecheck_result.stdout;
		if (!output.includes('svelte-check found 0 errors and 0 warnings')) {
			b.add_text(output, 'stdout from typecheck task');
		}
	}

	const test_result = await spawn_out('gro', ['test']); // TODO better way to omit/pick files - also need to handle that with typecheck above (or does svelte-check support it?)
	if (test_result.stderr) {
		b.add_text(test_result.stderr, 'stderr from test task');
	}
	if (test_result.stdout) {
		const output = map_test_output(test_result.stdout);
		if (output) {
			b.add_text(test_result.stdout, 'stdout from test task');
		}
	}

	return b.toString();
};

const map_test_output = (text: string): string => {
	const match = /Total:\s+(\d+)\s+Passed:\s+(\d+)/.exec(text);
	if (!match) return text;
	const total = match[1];
	const passed = match[2];
	return total === passed ? '' : text;
};
