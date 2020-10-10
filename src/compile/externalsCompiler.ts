import {basename, dirname} from 'path';

import {Logger, SystemLogger} from '../utils/log.js';
import {JS_EXTENSION} from '../paths.js';
import {omitUndefined} from '../utils/object.js';
import {Compiler, ExternalsCompilationSource, TextCompilation} from './compiler.js';
import {cyan} from '../colors/terminal.js';
import {buildExternalModule} from '../build/buildExternalModule.js';
import {printPath} from '../utils/print.js';

export interface Options {
	sourceMap: boolean;
	log: Logger;
}
export type InitialOptions = Partial<Options>;
export const initOptions = (opts: InitialOptions): Options => {
	const log = opts.log || new SystemLogger([cyan('[externalsCompiler]')]);
	return {
		sourceMap: false,
		...omitUndefined(opts),
		log,
	};
};

type ExternalsCompiler = Compiler<ExternalsCompilationSource, TextCompilation>;

export const createExternalsCompiler = (opts: InitialOptions = {}): ExternalsCompiler => {
	const {sourceMap, log} = initOptions(opts);

	if (sourceMap) {
		log.warn('Source maps are not yet supported by the externals compiler.');
	}

	const compile: ExternalsCompiler['compile'] = async (source, buildConfig, buildRootDir, dev) => {
		if (!dev) {
			throw Error('The externals compiler is currently not designed for production usage.');
		}
		if (source.encoding !== 'utf8') {
			throw Error(`Externals compiler only handles utf8 encoding, not ${source.encoding}`);
		}
		// TODO should this be cached on the source?
		const id = `${buildRootDir}${source.externalsDirBasePath}/${source.id}.js`;
		const dir = dirname(id);
		const filename = basename(id);

		log.info(`Bundling externals: ${source.id} → ${printPath(id)}`);

		let result;
		try {
			result = await buildExternalModule(source.id, id);
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
