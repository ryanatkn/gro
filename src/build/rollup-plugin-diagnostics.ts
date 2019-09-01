import {Plugin} from 'rollup';
import {gray} from 'kleur';

import {LogLevel, logger, fmtVal, fmtMs} from '../utils/logger';
import {timeTracker} from '../utils/timeUtils';
import {toRootPath} from '../paths';

export interface Options {
	logLevel: LogLevel;
}
export type RequiredOptions = never;
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (initialOptions: InitialOptions): Options => ({
	logLevel: LogLevel.Info,
	...initialOptions,
});

const name = 'diagnostics';

const tag = (s: string) => s; // maybe color this

export const diagnosticsPlugin = (opts: InitialOptions = {}): Plugin => {
	const {logLevel} = initOptions(opts);

	const {trace, info} = logger(logLevel, [gray(`[${name}]`)]);

	const getElapsed = timeTracker();
	let started = false;

	// TODO consider returning 2 plugins, one to be put first and one to go last to track timings
	return {
		name,
		// banner() {}
		buildStart() {
			info(tag('buildStart'));
			if (started) {
				getElapsed(); // reset the clock
			} else {
				info(fmtVal('startupTime', fmtMs(getElapsed())));
				started = true;
			}
		},
		buildEnd() {
			info(tag('buildEnd'));
		},
		// footer() {}
		generateBundle(_outputOptions, bundle, isWrite) {
			info(tag('generateBundle'), {isWrite, bundles: Object.keys(bundle)});
		},
		// intro() {}
		load(id) {
			trace(tag('load'), gray(toRootPath(id)));
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
			info(
				tag('renderChunk'),
				chunk.name,
				chunk.fileName,
				chunk.facadeModuleId && gray(toRootPath(chunk.facadeModuleId)),
			);
			return null;
		},
		// renderError(_error) {}
		renderStart() {
			info(tag('renderStart'));
		},
		// resolveDynamicImport(_specifier, _importer) {}
		// resolveFileUrl(_asset) {}
		resolveId(importee, importer) {
			trace(
				tag('resolveId'),
				gray(importee),
				(importer && gray('<- ' + toRootPath(importer))) || '',
			);
			return null;
		},
		// resolveImportMeta(_property, _asset) {}
		transform(code, id) {
			trace(
				tag('transform'),
				gray(toRootPath(id)),
				fmtVal('len', (code && code.length) || 0),
			);
			return null;
		},
		watchChange(id) {
			trace(tag('watchChange'), gray(id));
		},
		writeBundle(_bundle) {
			info(
				tag('writeBundle'),
				// TODO
				// print # of errors/warnings (maybe duplicate printing them here too)
				// how should that work?
				// ideally the state is contained here in the diagnostics plugin
				// could track what module is logging via the keyed tags.
				fmtVal('totalElapsed', fmtMs(getElapsed())),
			);
		},
	};
};
