import {print_ms, print_timings} from '@feltcoop/felt/util/print.js';
import type {Logger} from '@feltcoop/felt/util/log.js';
import {create_stopwatch, Timings} from '@feltcoop/felt/util/timings.js';
import {gray} from '@feltcoop/felt/util/terminal.js';

import {paths, to_types_build_dir} from '../paths.js';
import {Filer} from '../build/Filer.js';
import {gro_builder_default} from './gro_builder_default.js';
import type {GroConfig} from 'src/config/config.js';
import type {Filesystem} from 'src/fs/filesystem.js';
import {generate_types} from './typescript_utils.js';

export const build_source = async (
	fs: Filesystem,
	config: GroConfig,
	dev: boolean,
	log: Logger,
): Promise<void> => {
	log.info('building source', gray(dev ? 'development' : 'production'));

	const total_timing = create_stopwatch();
	const timings = new Timings();
	const log_timings = () => {
		print_timings(timings, log);
		log.info(`🕒 built in ${print_ms(total_timing())}`);
	};

	if (config.types) {
		log.info('building types');
		// Build all types so they're available.
		// TODO refactor? maybe lazily build types only when a builder wants them
		const timing_to_types = timings.start('types');
		await generate_types(paths.source, to_types_build_dir(), config.sourcemap, config.typemap);
		timing_to_types();
	}

	log.info('building files');
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
		types: config.types,
	});
	timing_to_create_filer();

	const timing_to_init_filer = timings.start('init filer');
	await filer.init();
	timing_to_init_filer();

	filer.close();

	log_timings();
};
