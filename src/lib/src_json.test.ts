import {test} from 'uvu';
import * as assert from 'uvu/assert';

import {to_src_modules} from './src_json.js';
import {to_package_exports} from './package_json.js';
import {paths} from './paths.js';

test('to_package_modules', () => {
	assert.equal(
		to_src_modules(
			to_package_exports([
				'fixtures/modules/some_test_css.css',
				'fixtures/modules/Some_Test_Svelte.svelte',
				'fixtures/modules/some_test_ts.ts',
				'fixtures/modules/some_test_json.json',
			]),
			undefined,
			paths.source,
		),
		{
			'./package.json': {path: 'package.json', declarations: []},
			'./fixtures/modules/some_test_css.css': {
				path: 'fixtures/modules/some_test_css.css',
				declarations: [],
			},
			'./fixtures/modules/some_test_json.json': {
				path: 'fixtures/modules/some_test_json.json',
				declarations: [],
			},
			'./fixtures/modules/Some_Test_Svelte.svelte': {
				path: 'fixtures/modules/Some_Test_Svelte.svelte',
				declarations: [],
			},
			'./fixtures/modules/some_test_ts.js': {
				path: 'fixtures/modules/some_test_ts.ts',
				declarations: [
					{name: 'a', kind: 'variable'},
					{name: 'some_test_ts', kind: 'variable'},
					{name: 'some_test_fn', kind: 'function'},
					{name: 'Some_Test_Type', kind: 'type'},
					{name: 'Some_Test_Interface', kind: 'type'},
					{name: 'Some_Test_Class', kind: 'class'},
				],
			},
		},
	);
});

test.run();
