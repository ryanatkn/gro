import {print_timings} from '@feltcoop/felt/util/print.js';
import {Timings} from '@feltcoop/felt/util/time.js';
import {spawn_process} from '@feltcoop/felt/util/process.js';

import type {Task} from './task/task.js';
import {Task_Error} from './task/task.js';
import {to_build_out_path, to_root_path} from './paths.js';
import {SYSTEM_BUILD_NAME} from './build/default_build_config.js';
import {load_config} from './config/config.js';
import {build_source} from './build/build_source.js';

// Runs the project's tests: `gro test [...args]`
// Args are passed through directly to `uvu`'s CLI:
// https://github.com/lukeed/uvu/blob/master/docs/cli.md

const DEFAULT_TEST_FILE_PATTERNS = ['.+\\.test\\.js$'];

export const task: Task = {
	description: 'run tests',
	run: async ({fs, dev, log, args}): Promise<void> => {
		const pattern_count = args._.length;
		const test_file_patterns = pattern_count ? args._ : DEFAULT_TEST_FILE_PATTERNS;

		const timings = new Timings();

		const tests_build_dir = to_build_out_path(dev, SYSTEM_BUILD_NAME);

		// TODO cleaner way to detect & rebuild?
		if (!(await fs.exists(tests_build_dir))) {
			const timing_to_load_config = timings.start('load config');
			const config = await load_config(fs, dev);
			timing_to_load_config();

			const timing_to_prebuild = timings.start('prebuild');
			await build_source(fs, config, dev, log);
			timing_to_prebuild();

			// Projects may not define any artifacts for the Node build,
			// and we don't force anything out in that case,
			// so just exit early if that happens.
			if (!(await fs.exists(tests_build_dir))) {
				log.info('no tests found');
				return;
			}
		}

		const time_to_run_uvu = timings.start('run test with uvu');
		const test_run_result = await spawn_process('npx', [
			'uvu',
			to_root_path(tests_build_dir),
			...test_file_patterns,
			...process.argv.slice(3 + pattern_count),
		]);
		time_to_run_uvu();

		print_timings(timings, log);

		if (!test_run_result.ok) {
			throw new Task_Error('Tests failed.');
		}
	},
};
