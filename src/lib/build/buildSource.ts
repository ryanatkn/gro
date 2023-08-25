import {printMs, printTimings} from '@feltjs/util/print.js';
import type {Logger} from '@feltjs/util/log.js';
import {createStopwatch, Timings} from '@feltjs/util/timings.js';
import {gray} from 'kleur/colors';

import {paths, toTypesBuildDir} from '../paths.js';
import {Filer} from '../build/Filer.js';
import {groBuilderDefault} from './groBuilderDefault.js';
import type {GroConfig} from '../config/config.js';
import type {Filesystem} from '../fs/filesystem.js';
import {generateTypes} from './typescriptUtils.js';
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

	if (config.builds.some((b) => b.types)) {
		log.debug('building types');
		// Build all types so they're available.
		// TODO refactor? maybe lazily build types only when a builder wants them
		const timingToTypes = timings.start('types');
		await generateTypes(paths.source, toTypesBuildDir(), config.sourcemap, config.typemap, log);
		timingToTypes();
	}

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
