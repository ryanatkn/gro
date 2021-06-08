import {print_ms, print_timings} from '@feltcoop/felt/utils/print.js';
import type {Logger} from '@feltcoop/felt/utils/log.js';
import {create_stopwatch, Timings} from '@feltcoop/felt/utils/time.js';

import {paths} from '../paths.js';
import {Filer} from '../build/Filer.js';
import {create_default_builder} from './default_builder.js';
import type {Gro_Config} from '../config/config.js';
import type {Filesystem} from '../fs/filesystem.js';

export const build_source_directory = async (
	fs: Filesystem,
	config: Gro_Config,
	dev: boolean,
	log: Logger,
): Promise<void> => {
	log.info('building source directory');

	const total_timing = create_stopwatch();
	const timings = new Timings();
	const log_timings = () => {
		print_timings(timings, log);
		log.info(`🕒 built in ${print_ms(total_timing())}`);
	};

	const timing_to_create_filer = timings.start('create filer');
	const filer = new Filer({
		fs,
		dev,
		builder: create_default_builder(),
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

	log_timings();
};
