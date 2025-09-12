import {describe, test, expect} from 'vitest';
import {resolve} from 'node:path';

import {search_fs} from './search_fs.ts';

describe('search_fs', () => {
	test('search_fs basic behavior', () => {
		const ignored_path = 'test1.foo.ts';
		let has_ignored_path = false;
		const result = search_fs('./src/fixtures', {
			filter: (path) => {
				if (!has_ignored_path) has_ignored_path = path.endsWith(ignored_path);
				return !path.endsWith(ignored_path);
			},
			sort: (a, b) => a.path.localeCompare(b.path) * -1,
		});
		expect(has_ignored_path).toBe(true); // makes sure the test isn't wrong
		const expected_files = [
			'test2.foo.ts',
			'test_ts.ts',
			'test_task_module.task_fixture.ts',
			'test_sveltekit_env.ts',
			'test_sveltekit_env_subprocess.ts',
			'test_run_task_invoke.ts',
			'test_run_task_failure.ts',
			'test_run_task_basic.ts',
			'test_run_gen.ts',
			'test_loader.ts',
			'test_js.js',
			'test_invalid_task_module.ts',
			'test_filer.md',
			'test_filer.gen.md.ts',
			'test_file.other.ext',
			'test_failing_task_module.ts',
			'some_test_side_effect.ts',
			'some_test_exports3.ts',
			'some_test_exports2.ts',
			'some_test_exports.ts',
			'modules/src_json_sample_exports.ts',
			'modules/some_test_ts.ts',
			'modules/Some_Test_Svelte.svelte',
			'modules/some_test_svelte_ts.svelte.ts',
			'modules/some_test_svelte_js.svelte.js',
			'modules/some_test_server.ts',
			'modules/some_test_script.ts',
			'modules/some_test_json.json',
			'modules/some_test_json_without_extension',
			'modules/some_test_js.js',
			'modules/some_test_css.css',
			'changelog_example.md',
			'changelog_cache.json',
			'baz2/test2.baz.ts',
			'baz1/test1.baz.ts',
			'bar2/test2.bar.ts',
			'bar1/test1.bar.ts',
		];
		expect(result.map((f) => f.path)).toEqual(expected_files);
		expect(result.map((f) => f.id)).toEqual(
			expected_files.map((f) => resolve(`src/fixtures/${f}`)),
		);
	});
});
