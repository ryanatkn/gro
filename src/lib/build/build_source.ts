import {printMs, printTimings} from '@feltjs/util/print.js';
import type {Logger} from '@feltjs/util/log.js';
import {createStopwatch, Timings} from '@feltjs/util/timings.js';
import {gray} from 'kleur/colors';

import {paths} from '../path/paths.js';
import {Filer} from './Filer.js';
import {gro_builder_default} from './gro_builder_default.js';
import type {GroConfig} from '../config/config.js';
import type {Filesystem} from '../fs/filesystem.js';
import {sveltekit_sync} from '../util/sveltekit_sync.js';

export const build_source = async (
	fs: Filesystem,
	config: GroConfig,
	dev: boolean,
	log: Logger,
): Promise<void> => {
	log.debug('building source', gray(dev ? 'development' : 'production'));

	await sveltekit_sync(fs);

	if (!config.builds.length) return;

	const total_timing = createStopwatch();
	const timings = new Timings();

	log.debug('building files');
	const timing_to_create_filer = timings.start('create filer');
	const filer = new Filer({
		fs,
		dev,
		builder: gro_builder_default(),
		source_dirs: [paths.source],
		build_configs: config.builds,
		watch: false,
		target: config.target,
		sourcemap: config.sourcemap,
	});
	timing_to_create_filer();

	const timing_to_init_filer = timings.start('init filer');
	await filer.init();
	timing_to_init_filer();

	filer.close();

	printTimings(timings, log);
	log.debug(`🕒 built in ${printMs(total_timing())}`);
};
