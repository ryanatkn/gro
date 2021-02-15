import {basename, dirname, join} from 'path';
import {ImportMap, install} from 'esinstall';

import {Logger, SystemLogger} from '../utils/log.js';
import {paths, JS_EXTENSION} from '../paths.js';
import {omitUndefined} from '../utils/object.js';
import {Builder, ExternalsBuildSource, TextBuild} from './builder.js';
import {cyan} from '../colors/terminal.js';
import {loadContents} from './load.js';
import {outputFile, remove} from '../fs/nodeFs.js';

/*

TODO this currently uses `esinstall` in a fairly hacky way.
It bundles each external import in isolation,
so each distinct import path will have its own bundle.
This could cause bugs when importing multiple modules from the same project
if those modules rely on shared module-level state.

The correct solution probably involves just using `esinstall` correctly
and shuffling a few things around.
I was unable to get expected behavior using a shared `importMap`,
but that's probably user error.

*/

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

		// TODO maybe hash the dest based on the build config? or tighter caching behavior, deleting stale stuff?
		const dest = externalsDir + '/temp/' + Math.round(Math.random() * 10_000_000_000);
		console.log('dest', dest);
		console.log(
			'buildRootDir, externalsDir, externalsDirBasePath',
			buildRootDir,
			externalsDir,
			externalsDirBasePath,
		);
		let id: string;

		log.info(`Bundling externals ${buildConfig.name}: ${source.id}`);

		let contents: string;
		try {
			const result = await install([source.id], {dest, importMap});
			// const result = await install(specifiers, {dest: externalsDir});
			importMap = result.importMap;
			console.log('\n\n\nsource.id', source.id);
			console.log('result.importMap', result.importMap);
			console.log('result.stats', result.stats);
			// TODO this `id` stuff is a hack, but it works for now i think
			const installedId = join(dest, result.importMap.imports[source.id]);
			console.log('installedId', installedId);
			id = join(externalsDir, result.importMap.imports[source.id]);
			console.log('id', id);
			contents = await loadContents(encoding, installedId); // TODO do we need to update the source file's data? might differ?
			// TODO probably move the file instead of removing/outputting
			await Promise.all([remove(dest), outputFile(id, contents, encoding)]);
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
