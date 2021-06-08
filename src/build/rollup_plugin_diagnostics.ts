import type {Plugin} from 'rollup';
import {gray} from '@feltcoop/felt/utils/terminal.js';
import {System_Logger} from '@feltcoop/felt/utils/log.js';
import {print_key_value, printMs} from '@feltcoop/felt/utils/print.js';
import {create_stopwatch} from '@feltcoop/felt/utils/time.js';

import {print_path} from '../paths.js';

export const name = 'diagnostics';

const tag = (s: string) => s; // maybe color this

export const diagnosticsPlugin = (): Plugin => {
	const log = new System_Logger(gray(`[${name}]`));

	const stopwatch = create_stopwatch();
	let started = false;

	// TODO consider returning 2 plugins, one to be put first and one to go last to track timings
	return {
		name,
		// banner() {}
		buildStart() {
			log.info(tag('buildStart'));
			if (started) {
				stopwatch(true); // reset the clock
			} else {
				log.info(print_key_value('startupTime', printMs(stopwatch(true))));
				started = true;
			}
		},
		buildEnd() {
			log.info(tag('buildEnd'));
		},
		// footer() {}
		generateBundle(_output_options, bundle, is_write) {
			log.info(tag('generateBundle'), {is_write, bundles: Object.keys(bundle)});
		},
		// intro() {}
		load(_id) {
			// log.trace(tag('load'), print_path(id));
			return null;
		},
		options(_o) {
			// trace(tag('options'), o);
			return null;
		},
		// outputOptions(o) {
		// 	log(tag('outputOptions'), o);
		// 	return null;
		// },
		// outro() {}
		renderChunk(_code, chunk, _options) {
			log.info(
				tag('renderChunk'),
				chunk.name,
				chunk.fileName,
				chunk.facadeModuleId && print_path(chunk.facadeModuleId),
			);
			return null;
		},
		// renderError(_error) {}
		renderStart() {
			log.info(tag('renderStart'));
		},
		// resolveDynamicImport(_specifier, _importer) {}
		// resolveFileUrl(_asset) {}
		resolveId(_importee, _importer) {
			// log.trace(tag('resolveId'), gray(importee), (importer && '<- ' + print_path(importer)) || '');
			return null;
		},
		// resolveImportMeta(_property, _asset) {}
		transform(_code, _id) {
			// log.trace(tag('transform'), print_path(id), print_key_value('len', (code && code.length) || 0));
			return null;
		},
		watchChange(id) {
			log.trace(tag('watchChange'), gray(id));
		},
		writeBundle(_bundle) {
			log.info(
				tag('writeBundle'),
				// TODO
				// log # of errors/warnings (maybe duplicate logging them here too)
				// how should that work?
				// ideally the state is contained here in the diagnostics plugin
				// could track what module is logging via the keyed tags.
				print_key_value('totalElapsed', printMs(stopwatch())),
			);
		},
	};
};
