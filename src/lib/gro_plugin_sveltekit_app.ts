import type {SpawnedProcess} from '@fuzdev/fuz_util/process.js';

import type {Plugin} from './plugin.ts';
import {serialize_args, to_forwarded_args} from './args.ts';
import {TaskError} from './task.ts';
import {find_cli, spawn_cli, spawn_cli_process} from './cli.ts';
import {VITE_CLI} from './constants.ts';

export interface GroPluginSveltekitAppOptions {
	/**
	 * The Vite CLI to use.
	 */
	vite_cli?: string;
}

export const gro_plugin_sveltekit_app = ({
	vite_cli = VITE_CLI,
}: GroPluginSveltekitAppOptions = {}): Plugin => {
	let sveltekit_process: SpawnedProcess | undefined = undefined;
	return {
		name: 'gro_plugin_sveltekit_app',
		setup: async ({dev, watch, log, config}) => {
			const found_vite_cli = await find_cli(vite_cli);
			if (!found_vite_cli)
				throw Error(
					`Failed to find Vite CLI \`${vite_cli}\`, do you need to run \`${config.pm_cli} i\`?`,
				);
			if (dev) {
				// `vite dev` in development mode
				if (watch) {
					const serialized_args = ['dev', ...serialize_args(to_forwarded_args(vite_cli))];
					sveltekit_process = await spawn_cli_process(found_vite_cli, serialized_args, log);
				} else {
					log.debug(
						`the SvelteKit app plugin is loaded but will not output anything` +
							' because `dev` is true and `watch` is false',
					);
				}
			} else {
				// `vite build` in production mode
				const serialized_args = ['build', ...serialize_args(to_forwarded_args(vite_cli))];
				const spawned = await spawn_cli(found_vite_cli, serialized_args, log);
				if (!spawned?.ok) {
					throw new TaskError(`${vite_cli} build failed with exit code ${spawned?.code}`);
				}
			}
		},
		teardown: async () => {
			if (sveltekit_process) {
				sveltekit_process.child.kill();
				await sveltekit_process.closed;
			}
		},
	};
};
