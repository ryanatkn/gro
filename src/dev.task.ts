import {printTimings} from '@feltcoop/felt/util/print.js';
import {Timings} from '@feltcoop/felt/util/timings.js';
import {z} from 'zod';

import type {Task} from './task/task.js';
import {Filer} from './build/Filer.js';
import {groBuilderDefault} from './build/groBuilderDefault.js';
import {paths} from './paths.js';
import {loadConfig, type GroConfig} from './config/config.js';
import {Plugins, type PluginContext} from './plugin/plugin.js';
import type {ArgsSchema} from './utils/args.js';
import {toVocabSchema} from './utils/schema.js';

export interface TaskEvents {
	'dev.createConfig': (config: GroConfig) => void;
	'dev.createFiler': (filer: Filer) => void;
	'dev.createContext': (ctx: DevTaskContext) => void;
	'dev.ready': (ctx: DevTaskContext) => void;
}

const Args = z.object({
	watch: z.boolean({description: ''}).default(true),
	'no-watch': z
		.boolean({
			description: 'opt out of running a long-lived process to watch files and rebuild on changes',
		})
		.optional() // TODO behavior differs now with zod, because of `default` this does nothing
		.default(false),
	// TODO this flag is weird, it detects https credentials but should probably be explicit and fail if not available
	insecure: z.boolean({description: 'ignore https credentials'}).optional(),
	cert: z.string({description: 'https certificate file'}).optional(),
	certkey: z.string({description: 'https certificate key file'}).optional(),
});
type Args = z.infer<typeof Args>;

export type DevTaskContext = PluginContext<Args, TaskEvents>;

export const task: Task<Args, TaskEvents> = {
	summary: 'start SvelteKit and other dev plugins',
	Args,
	args: toVocabSchema(Args, 'DevTaskArgs') as ArgsSchema,
	run: async (ctx) => {
		const {fs, dev, log, args, events} = ctx;
		const {watch} = args;

		const timings = new Timings();

		const timingToLoadConfig = timings.start('load config');
		const config = await loadConfig(fs, dev);
		timingToLoadConfig();
		events.emit('dev.createConfig', config);

		const timingToCreateFiler = timings.start('create filer');
		const filer = new Filer({
			fs,
			dev,
			builder: groBuilderDefault(),
			sourceDirs: [paths.source],
			buildConfigs: config.builds,
			target: config.target,
			sourcemap: config.sourcemap,
			watch,
		});
		timingToCreateFiler();
		events.emit('dev.createFiler', filer);

		const devTaskContext: DevTaskContext = {...ctx, config, filer, timings};
		events.emit('dev.createContext', devTaskContext);

		const plugins = await Plugins.create(devTaskContext);

		const timingToInitFiler = timings.start('init filer');
		await filer.init();
		timingToInitFiler();

		await plugins.setup();

		events.emit('dev.ready', devTaskContext);

		if (!watch) {
			await plugins.teardown();
		}

		printTimings(timings, log);
	},
};
