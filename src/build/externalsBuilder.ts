import {basename, dirname, join} from 'path';
import {install} from 'esinstall';
import {Plugin as RollupPlugin} from 'rollup';

import {Logger, SystemLogger} from '../utils/log.js';
import {JS_EXTENSION} from '../paths.js';
import {omitUndefined} from '../utils/object.js';
import {Builder, ExternalsBuildSource, TextBuild} from './builder.js';
import {cyan, gray} from '../colors/terminal.js';
import {loadContents} from './load.js';
import {remove, move} from '../fs/nodeFs.js';
import {groSveltePlugin} from '../project/rollup-plugin-gro-svelte.js';
import {createDefaultPreprocessor} from './svelteBuildHelpers.js';
import {createCssCache} from '../project/cssCache.js';

/*

TODO this currently uses `esinstall` in a fairly hacky way.
It bundles each external import in isolation,
so each distinct import path will have its own bundle.
This could cause bugs when importing multiple modules from the same project
if those modules rely on shared module-level state.

The correct solution probably involves just using `esinstall` correctly
and shuffling a few things around.
I was unable to get expected behavior using a shared `importMap`,
so either I don't understand something or I'm holding it wrong.

*/

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

const encoding = 'utf8';

export const createExternalsBuilder = (opts: InitialOptions = {}): ExternalsBuilder => {
	const {log} = initOptions(opts);

	const build: ExternalsBuilder['build'] = async (
		source,
		buildConfig,
		{buildRootDir, dev, externalsDirBasePath, sourceMap},
	) => {
		if (sourceMap) {
			log.warn('Source maps are not yet supported by the externals builder.');
		}
		if (!dev) {
			throw Error('The externals builder is currently not designed for production usage.');
		}
		if (source.encoding !== encoding) {
			throw Error(`Externals builder only handles utf8 encoding, not ${source.encoding}`);
		}

		// TODO maybe hash the dest based on the build config? or tighter caching behavior, deleting stale stuff?
		const dir = buildRootDir + externalsDirBasePath;
		const dest = `${dir}/temp${Math.random()}`;
		let id: string;

		log.info(`bundling externals ${buildConfig.name}: ${gray(source.id)}`);

		// const addPlainCssBuild = cssCache.addCssBuild.bind(null, 'bundle.plain.css');
		const cssCache = createCssCache();
		const addSvelteCssBuild = cssCache.addCssBuild.bind(null, 'bundle.svelte.css');

		const plugins: RollupPlugin[] = [
			groSveltePlugin({
				dev,
				addCssBuild: addSvelteCssBuild,
				preprocessor: createDefaultPreprocessor(sourceMap, 'es2019'),
				compileOptions: {},
			}),
		];

		let contents: string;
		try {
			const result = await install([source.id], {dest, rollup: {plugins}});
			const installedId = join(dest, result.importMap.imports[source.id]);
			id = join(buildRootDir, externalsDirBasePath, result.importMap.imports[source.id]);
			contents = await loadContents(encoding, installedId);
			await move(installedId, id);
			await remove(dest);
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
