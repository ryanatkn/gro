import {test} from 'uvu';
import * as assert from 'uvu/assert';

import {format_file} from './format_file.js';

test('format_files calls to a function', async () => {
	const ts_unformatted = 'hey (1)';
	const ts_formatted = 'hey(1);\n';
	assert.is(await format_file(ts_unformatted, {filepath: 'foo.ts'}), ts_formatted);
	assert.is(await format_file(ts_unformatted, {parser: 'typescript'}), ts_formatted);

	const svelte_unformatted = '<style>a{color: red}</style>';
	const svelte_formatted = '<style>\n\ta {\n\t\tcolor: red;\n\t}\n</style>\n';
	assert.is(await format_file(svelte_unformatted, {filepath: 'foo.svelte'}), svelte_formatted);
	assert.is(await format_file(svelte_unformatted, {parser: 'svelte'}), svelte_formatted);
});

test.run();
