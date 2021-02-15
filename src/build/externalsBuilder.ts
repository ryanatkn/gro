import {basename, dirname, join} from 'path';
import {install} from 'esinstall';

import {Logger, SystemLogger} from '../utils/log.js';
import {paths, JS_EXTENSION} from '../paths.js';
import {omitUndefined} from '../utils/object.js';
import {Builder, ExternalsBuildSource, TextBuild} from './builder.js';
import {cyan} from '../colors/terminal.js';
import {printPath} from '../utils/print.js';
import {loadContents} from './load.js';

export interface Options {
	log: Logger;
	externalsDir: string;
}
export type InitialOptions = Partial<Options>;
export const initOptions = (opts: InitialOptions): Options => {
	const log = opts.log || new SystemLogger([cyan('[externalsBuilder]')]);
	return {
		externalsDir: paths.externals,
		...omitUndefined(opts),
		log,
	};
};

type ExternalsBuilder = Builder<ExternalsBuildSource, TextBuild>;

const encoding = 'utf8';

export const createExternalsBuilder = (opts: InitialOptions = {}): ExternalsBuilder => {
	const {log, externalsDir} = initOptions(opts);

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
		if (source.encoding !== encoding) {
			throw Error(`Externals builder only handles utf8 encoding, not ${source.encoding}`);
		}
		// TODO should this be cached on the source?
		const id = `${buildRootDir}${externalsDirBasePath}/${source.id}.js`;
		const dir = dirname(id);
		const filename = basename(id);

		log.info(`Bundling externals: ${source.id} → ${printPath(id)}`);

		let contents: string;
		try {
			const result = await installExternal(source.id, {dest: externalsDir});
			// const result = await install(specifiers, {dest: externalsDir});
			console.log('\n\n\nsource.id', source.id);
			console.log('result.importMap', result.importMap);
			console.log('result.stats', result.stats);
			// TODO this `outputId` stuff is a hack, but it works for now i think
			const outputId = join(externalsDir, result.importMap.imports[source.id]);
			console.log('outputId', outputId);
			contents = await loadContents(encoding, outputId); // TODO do we need to update the source file's data? might differ?
			console.log('source.', source);
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
				encoding,
				contents,
				sourceMapOf: null,
				buildConfig,
			},
		];

		return {builds};
	};

	return {build};
};

const specifiers: string[] = [];
let installing: ReturnType<typeof install> | null = null;

/*

The `esinstall` API appears to dislike concurrent `install` calls,
so this is a hacky fix around it.

TODO debounce or something to batch

*/
const installExternal = async (
	sourceId: string,
	options: Parameters<typeof install>[1],
): ReturnType<typeof install> => {
	if (specifiers.includes(sourceId)) {
		console.log('TODO should this short-circuit?');
		return installing!;
	}
	const oldInstalling = installing;
	await installing;
	if (oldInstalling !== installing) return installExternal(sourceId, options); // queued
	specifiers.push(sourceId);
	console.log('\n\n\n\n\ninstall!', sourceId, specifiers);
	console.log('\nurl', import.meta.url);
	installing = install(specifiers, options);
	const result = await installing;
	return result;
};
