import {printMs, print_timings} from '@feltcoop/felt/utils/print.js';
import type {Logger} from '@feltcoop/felt/utils/log.js';
import {createStopwatch, Timings} from '@feltcoop/felt/utils/time.js';

import {paths} from '../paths.js';
import {Filer} from '../build/Filer.js';
import {createDefaultBuilder} from './defaultBuilder.js';
import type {Gro_Config} from '../config/config.js';
import type {Filesystem} from '../fs/filesystem.js';

export const build_source_directory = async (
	fs: Filesystem,
	config: Gro_Config,
	dev: boolean,
	log: Logger,
): Promise<void> => {
	log.info('building source directory');

	const totalTiming = createStopwatch();
	const timings = new Timings();
	const logTimings = () => {
		print_timings(timings, log);
		log.info(`🕒 built in ${printMs(totalTiming())}`);
	};

	const timingToCreateFiler = timings.start('create filer');
	const filer = new Filer({
		fs,
		dev,
		builder: createDefaultBuilder(),
		sourceDirs: [paths.source],
		build_configs: config.builds,
		watch: false,
		target: config.target,
		sourcemap: config.sourcemap,
	});
	timingToCreateFiler();

	const timingToInitFiler = timings.start('init filer');
	await filer.init();
	timingToInitFiler();

	filer.close();

	logTimings();
};
