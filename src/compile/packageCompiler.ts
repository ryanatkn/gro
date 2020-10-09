import {basename, dirname} from 'path';

import {Logger, SystemLogger} from '../utils/log.js';
import {EXTERNALS_DIR, JS_EXTENSION} from '../paths.js';
import {omitUndefined} from '../utils/object.js';
import {Compiler, PackageCompilationSource, TextCompilation} from './compiler.js';
import {cyan} from '../colors/terminal.js';
import {buildExternalModule} from '../build/buildExternalModule.js';
import {printPath} from '../utils/print.js';

export interface Options {
	sourceMap: boolean;
	externalsBasePath: string;
	log: Logger;
}
export type InitialOptions = Partial<Options>;
export const initOptions = (opts: InitialOptions): Options => {
	const log = opts.log || new SystemLogger([cyan('[packageCompiler]')]);
	return {
		sourceMap: false,
		externalsBasePath: EXTERNALS_DIR,
		...omitUndefined(opts),
		log,
	};
};

type PackageCompiler = Compiler<PackageCompilationSource, TextCompilation>;

export const createPackageCompiler = (opts: InitialOptions = {}): PackageCompiler => {
	const {sourceMap, externalsBasePath, log} = initOptions(opts);

	if (sourceMap) {
		log.warn('Source maps are not yet supported by the package compiler.');
	}

	const compile: PackageCompiler['compile'] = async (source, buildConfig, buildRootDir, dev) => {
		if (!dev) {
			throw Error('The package compiler is currently not designed for production usage.');
		}
		if (source.encoding !== 'utf8') {
			throw Error(`Package compiler only handles utf8 encoding, not ${source.encoding}`);
		}
		// TODO should this be cached on the source?
		const id = `${buildRootDir}${externalsBasePath}/${source.id}.js`;
		const dir = dirname(id);
		const filename = basename(id);

		log.info(`Bundling package: ${source.id} → ${printPath(id)}`);

		let result;
		try {
			result = await buildExternalModule(source.id, id, log);
		} catch (err) {
			log.error(`Failed to bundle external module: ${source.id} from ${id}`);
			throw err;
		}

		const compilations: TextCompilation[] = [
			{
				id,
				filename,
				dir,
				extension: JS_EXTENSION,
				encoding: 'utf8',
				contents: result.code,
				sourceMapOf: null,
				buildConfig,
			},
		];

		return {compilations};
	};

	return {compile};
};
