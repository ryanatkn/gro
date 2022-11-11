import {printMs, printTimings} from '@feltcoop/util/print.js';
import type {Logger} from '@feltcoop/util/log.js';
import {createStopwatch, Timings} from '@feltcoop/util/timings.js';
import {gray} from 'kleur/colors';

import {paths, toTypesBuildDir} from '../paths.js';
import {Filer} from '../build/Filer.js';
import {groBuilderDefault} from './groBuilderDefault.js';
import type {GroConfig} from '../config/config.js';
import type {Filesystem} from '../fs/filesystem.js';
import {generateTypes} from './typescriptUtils.js';
import {sveltekitSync} from '../utils/sveltekit.js';

export const buildSource = async (
	fs: Filesystem,
	config: GroConfig,
	dev: boolean,
	log: Logger,
): Promise<void> => {
	log.info('building source', gray(dev ? 'development' : 'production'));

	await sveltekitSync(fs);

	const totalTiming = createStopwatch();
	const timings = new Timings();
	const logTimings = () => {
		printTimings(timings, log);
		log.info(`🕒 built in ${printMs(totalTiming())}`);
	};

	if (config.types) {
		log.info('building types');
		// Build all types so they're available.
		// TODO refactor? maybe lazily build types only when a builder wants them
		const timingToTypes = timings.start('types');
		await generateTypes(paths.source, toTypesBuildDir(), config.sourcemap, config.typemap, log);
		timingToTypes();
	}

	log.info('building files');
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
		types: config.types,
	});
	timingToCreateFiler();

	const timingToInitFiler = timings.start('init filer');
	await filer.init();
	timingToInitFiler();

	filer.close();

	logTimings();
};
