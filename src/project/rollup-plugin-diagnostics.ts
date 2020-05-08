import {Plugin} from 'rollup';

import {gray} from '../colors/terminal.js';
import {SystemLogger} from '../utils/log.js';
import {printKeyValue, printMs, printPath} from '../utils/print.js';
import {createStopwatch} from '../utils/time.js';

const name = 'diagnostics';

const tag = (s: string) => s; // maybe color this

export const diagnosticsPlugin = (): Plugin => {
	const log = new SystemLogger([gray(`[${name}]`)]);

	const stopwatch = createStopwatch();
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
				log.info(printKeyValue('startupTime', printMs(stopwatch(true))));
				started = true;
			}
		},
		buildEnd() {
			log.info(tag('buildEnd'));
		},
		// footer() {}
		generateBundle(_outputOptions, bundle, isWrite) {
			log.info(tag('generateBundle'), {isWrite, bundles: Object.keys(bundle)});
		},
		// intro() {}
		load(id) {
			log.trace(tag('load'), printPath(id));
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
				chunk.facadeModuleId && printPath(chunk.facadeModuleId),
			);
			return null;
		},
		// renderError(_error) {}
		renderStart() {
			log.info(tag('renderStart'));
		},
		// resolveDynamicImport(_specifier, _importer) {}
		// resolveFileUrl(_asset) {}
		resolveId(importee, importer) {
			log.trace(
				tag('resolveId'),
				gray(importee),
				(importer && '<- ' + printPath(importer)) || '',
			);
			return null;
		},
		// resolveImportMeta(_property, _asset) {}
		transform(code, id) {
			log.trace(
				tag('transform'),
				printPath(id),
				printKeyValue('len', (code && code.length) || 0),
			);
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
				printKeyValue('totalElapsed', printMs(stopwatch())),
			);
		},
	};
};
