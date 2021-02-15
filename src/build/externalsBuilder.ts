import {basename, dirname, join} from 'path';
import {ImportMap, install} from 'esinstall';

import {Logger, SystemLogger} from '../utils/log.js';
import {paths, JS_EXTENSION} from '../paths.js';
import {omitUndefined} from '../utils/object.js';
import {Builder, ExternalsBuildSource, TextBuild} from './builder.js';
import {cyan} from '../colors/terminal.js';
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

let importMap: ImportMap | undefined = undefined;

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

		let id: string;

		log.info(`Bundling externals ${buildConfig.name}: ${source.id}`);

		let contents: string;
		try {
			const result = await installExternal(source.id, {dest: externalsDir, importMap});
			// const result = await install(specifiers, {dest: externalsDir});
			importMap = result.importMap;
			console.log('\n\n\nsource.id', source.id);
			console.log('result.importMap', result.importMap);
			console.log('result.stats', result.stats);
			// TODO this `id` stuff is a hack, but it works for now i think
			id = join(buildRootDir, externalsDirBasePath || '', result.importMap.imports[source.id]);
			console.log('id', id);
			contents = await loadContents(encoding, id); // TODO do we need to update the source file's data? might differ?
		} catch (err) {
			log.error(`Failed to bundle external module: ${source.id}`);
			throw err;
		}

		const builds: TextBuild[] = [
			{
				id,
				filename: basename(id),
				dir: dirname(id),
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
	if (oldInstalling !== installing) {
		console.log('WAITING');
		await new Promise((resolve) => setTimeout(resolve, 100)); // TODO hack
		return installExternal(sourceId, options); // queued
	}
	specifiers.push(sourceId);
	console.log('\n\n\n\n\ninstall!', sourceId, specifiers);
	console.log('\nurl', import.meta.url);
	installing = install(specifiers, options);
	console.log('installing...');
	const result = await installing;
	console.log('installed!');
	return result;
};
