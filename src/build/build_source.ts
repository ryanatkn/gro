import {print_ms, print_timings} from '@feltcoop/felt/util/print.js';
import type {Logger} from '@feltcoop/felt/util/log.js';
import {create_stopwatch, Timings} from '@feltcoop/felt/util/time.js';
import {gray} from '@feltcoop/felt/util/terminal.js';

import {paths, to_types_build_dir} from '../paths.js';
import {Filer} from '../build/Filer.js';
import {create_default_builder} from './default_builder.js';
import type {Gro_Config} from '../config/config.js';
import type {Filesystem} from '../fs/filesystem.js';
import {generate_types} from './ts_build_helpers.js';

export const build_source = async (
	fs: Filesystem,
	config: Gro_Config,
	dev: boolean,
	log: Logger,
	types: boolean = !dev,
): Promise<void> => {
	log.info('building source directory', gray(dev ? 'development' : 'production'));

	const total_timing = create_stopwatch();
	const timings = new Timings();
	const log_timings = () => {
		print_timings(timings, log);
		log.info(`🕒 built in ${print_ms(total_timing())}`);
	};

	if (types) {
		log.info('building types');
		// Build all types so they're available.
		// TODO refactor? maybe lazily build types only when a builder wants them
		const timing_to_types = timings.start('types');
		await generate_types(paths.source, to_types_build_dir(), config.sourcemap);
		timing_to_types();
	}

	log.info('building files');
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
		types,
	});
	timing_to_create_filer();

	const timing_to_init_filer = timings.start('init filer');
	await filer.init();
	timing_to_init_filer();

	filer.close();

	log_timings();
};
