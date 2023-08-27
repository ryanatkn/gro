import {printMs, printTimings} from '@feltjs/util/print.js';
import type {Logger} from '@feltjs/util/log.js';
import {createStopwatch, Timings} from '@feltjs/util/timings.js';
import {gray} from 'kleur/colors';

import {paths} from '../path/paths.js';
import {Filer} from '../build/Filer.js';
import {groBuilderDefault} from './groBuilderDefault.js';
import type {GroConfig} from '../config/config.js';
import type {Filesystem} from '../fs/filesystem.js';
import {sveltekitSync} from '../util/sveltekit.js';

export const buildSource = async (
	fs: Filesystem,
	config: GroConfig,
	dev: boolean,
	log: Logger,
): Promise<void> => {
	log.debug('building source', gray(dev ? 'development' : 'production'));

	await sveltekitSync(fs);

	const totalTiming = createStopwatch();
	const timings = new Timings();
	const logTimings = () => {
		printTimings(timings, log);
		log.debug(`🕒 built in ${printMs(totalTiming())}`);
	};

	log.debug('building files');
	const timingToCreateFiler = timings.start('create filer');
	const filer = new Filer({
		fs,
		dev,
		builder: groBuilderDefault(),
		sourceDirs: [paths.source],
		buildConfigs: config.builds,
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
