import {Timings} from '@feltcoop/felt/util/time.js';
import {spawn} from '@feltcoop/felt/util/process.js';
import type {Spawned_Process} from '@feltcoop/felt/util/process.js';
import {green} from '@feltcoop/felt/util/terminal.js';
import {print_timings} from '@feltcoop/felt/util/print.js';

import type {Task} from './task/task.js';
import {DIST_DIRNAME, paths, source_id_to_base_path, to_build_extension} from './paths.js';
import type {Gro_Config} from './config/config.js';
import {load_config} from './config/config.js';
import type {Build_Config} from './build/build_config.js';
import {to_input_files} from './build/build_config.js';
import {
	has_api_server,
	has_sveltekit_frontend,
	to_api_server_port,
} from './build/default_build_config.js';
import type {Task_Args as Serve_Task_Args} from './serve.task.js';
import {to_sveltekit_base_path} from './build/sveltekit_helpers.js';
import {load_package_json} from './utils/package_json.js';

export interface Task_Args extends Serve_Task_Args {}

export interface Task_Events {
	'start.spawned': (spawneds: Spawned_Process[], config: Gro_Config) => void;
}

export const task: Task<Task_Args, Task_Events> = {
	description: 'runs the dist/ builds for production',
	dev: false,
	run: async ({fs, log, invoke_task, dev, events, args}) => {
		const timings = new Timings();

		// build if needed
		if (!(await fs.exists(paths.dist))) {
			log.info(green('dist not detected; building'));
			const timing_to_build = timings.start('build');
			await invoke_task('build');
			timing_to_build();
		}

		const timing_to_load_config = timings.start('load config');
		const config = await load_config(fs, dev);
		timing_to_load_config();

		// detect if we're in a SvelteKit project, and prefer that to Gro's system for now
		if ((await has_sveltekit_frontend(fs)) && !(await has_api_server(fs))) {
			// `svelte-kit start` is not respecting the `svelte.config.cjs` property `paths.base`,
			// so we serve up the dist ourselves. we were going to anyway, if we're being honest
			args.serve = [
				{
					path: DIST_DIRNAME,
					base: dev ? '' : to_sveltekit_base_path(await load_package_json(fs), dev),
				},
			];
			await invoke_task('serve', {...args, port: args.port || to_api_server_port(dev)});
		} else {
			const inputs: {
				build_config: Build_Config;
				input: string;
			}[] = (
				await Promise.all(
					// TODO this needs to be changed, might need to configure on each `build_config`
					// maybe `dist: ['/path/to']` or `dist: {'/path/to': ...}`
					config.builds.map(async (build_config) =>
						to_input_files(build_config.input).map((input) => ({
							build_config,
							input,
						})),
					),
				)
			).flat();
			const spawneds: Spawned_Process[] = inputs
				.map((input) => {
					// TODO
					// if (!input.build_config.dist) return null!;
					const path = toEntryPath(input.build_config);
					if (!path) {
						log.error('expected to find entry path for build config', input.build_config);
						return null!;
					}
					return spawn('node', [path]);
				})
				.filter(Boolean);
			events.emit('start.spawned', spawneds, config);
		}
		print_timings(timings, log);
	},
};

// TODO where does this utility belong?
const toEntryPath = (build_config: Build_Config): string | null => {
	// TODO this just looks for the first one - need better control, if this pattern is stabilized
	const source_id = build_config.input.find((input) => typeof input === 'string') as
		| string
		| undefined;
	if (!source_id) return null;
	return `${paths.dist}${to_build_extension(source_id_to_base_path(source_id))}`;
};
