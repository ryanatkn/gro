import {basename, dirname} from 'path';

import {Logger, SystemLogger} from '../utils/log.js';
import {JS_EXTENSION} from '../paths.js';
import {omitUndefined} from '../utils/object.js';
import {Builder, ExternalsBuildSource, TextBuild} from './builder.js';
import {cyan} from '../colors/terminal.js';
import {buildExternalModule} from '../build/buildExternalModule.js';
import {printPath} from '../utils/print.js';

export interface Options {
	log: Logger;
}
export type InitialOptions = Partial<Options>;
export const initOptions = (opts: InitialOptions): Options => {
	const log = opts.log || new SystemLogger([cyan('[externalsBuilder]')]);
	return {
		...omitUndefined(opts),
		log,
	};
};

type ExternalsBuilder = Builder<ExternalsBuildSource, TextBuild>;

export const createExternalsBuilder = (opts: InitialOptions = {}): ExternalsBuilder => {
	const {log} = initOptions(opts);

	const build: ExternalsBuilder['build'] = async (
		source,
		buildConfig,
		{buildRootDir, dev, externalsDirBasePath /*, sourceMap */},
	) => {
		// if (sourceMap) {
		// 	log.warn('Source maps are not yet supported by the externals builder.');
		// }
		if (!dev) {
			throw Error('The externals builder is currently not designed for production usage.');
		}
		if (source.encoding !== 'utf8') {
			throw Error(`Externals builder only handles utf8 encoding, not ${source.encoding}`);
		}
		// TODO should this be cached on the source?
		const id = `${buildRootDir}${externalsDirBasePath}/${source.id}.js`;
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

		const builds: TextBuild[] = [
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

		return {builds};
	};

	return {build};
};
