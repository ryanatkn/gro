import {basename, dirname, join} from 'path';
import {install, InstallResult} from 'esinstall';
import {Plugin as RollupPlugin} from 'rollup';

import {Logger, SystemLogger} from '../utils/log.js';
import {JS_EXTENSION} from '../paths.js';
import {omitUndefined} from '../utils/object.js';
import {Builder, BuilderState, ExternalsBuildSource, TextBuild} from './builder.js';
import {cyan, gray} from '../colors/terminal.js';
import {loadContents} from './load.js';
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
		{buildRootDir, dev, externalsDirBasePath, sourceMap, target, state},
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

		const dest = buildRootDir + externalsDirBasePath;
		let id: string;

		log.info(`bundling externals ${buildConfig.name}: ${gray(source.id)}`);

		// TODO add an external API for customizing the `install` params
		// TODO this is legacy stuff that we need to rethink when we handle CSS better
		const cssCache = createCssCache();
		// const addPlainCssBuild = cssCache.addCssBuild.bind(null, 'bundle.plain.css');
		const addSvelteCssBuild = cssCache.addCssBuild.bind(null, 'bundle.svelte.css');
		const plugins: RollupPlugin[] = [
			groSveltePlugin({
				dev,
				addCssBuild: addSvelteCssBuild,
				preprocessor: createDefaultPreprocessor(sourceMap, target),
				compileOptions: {},
			}),
		];

		let contents: string;
		try {
			const result = await installExternal(
				source.id,
				dest,
				getExternalsBuilderState(state),
				plugins,
			);
			console.log('externals built', source.id);
			const installedId = join(dest, result.importMap.imports[source.id]);
			id = join(buildRootDir, externalsDirBasePath, result.importMap.imports[source.id]);
			contents = await loadContents(encoding, installedId);
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

const BATCH_INSTALL_TIMEOUT = 2000; // TODO this is so hacky

const installExternal = async (
	sourceId: string,
	dest: string,
	state: ExternalsBuilderState,
	plugins: RollupPlugin[],
): Promise<InstallResult> => {
	if (state.installing === null) {
		state.installing = createDelayedPromise(() =>
			installExternals(state.specifiers, dest, plugins),
		);
	}
	if (state.specifiers.includes(sourceId)) return state.installing.promise;
	state.specifiers.push(sourceId);
	state.installing.reset();
	return state.installing.promise;
};

const createDelayedPromise = <T>(cb: () => Promise<T>): DelayedPromise<T> => {
	let resolve: any, reject: any;
	const promise = new Promise<T>((r1, r2) => ((resolve = r1), (reject = r2)));
	let timeout: NodeJS.Timeout | null = null;
	const delayed: DelayedPromise<T> = {
		promise,
		reset() {
			if (timeout !== null) {
				clearTimeout(timeout);
				timeout = null;
			}
			startTimeout();
		},
	};
	const startTimeout = () => {
		if (timeout !== null) throw Error(`Expected timeout to be null`);
		timeout = setTimeout(async () => {
			cb().then(resolve, reject);
		}, BATCH_INSTALL_TIMEOUT);
	};
	startTimeout();
	return delayed;
};

interface DelayedPromise<T> {
	promise: Promise<T>;
	reset(): void;
}

const installExternals = async (
	specifiers: string[],
	dest: string,
	plugins: RollupPlugin[],
): Promise<InstallResult> => {
	const result = await install(Array.from(specifiers), {dest, rollup: {plugins}});
	console.log('result', result);
	// const installedId = join(dest, result.importMap.imports[source.id]);
	// id = join(buildRootDir, externalsDirBasePath, result.importMap.imports[source.id]);
	// contents = await loadContents(encoding, installedId);
	// await move(installedId, id);
	// await remove(dest);
	return result;
};

interface ExternalsBuilderState {
	specifiers: string[];
	timeout: NodeJS.Timeout | null;
	installing: DelayedPromise<InstallResult> | null;
}

const EXTERNALS_BUILDER_STATE_KEY = 'externals';

const getExternalsBuilderState = (state: BuilderState): ExternalsBuilderState => {
	let s: ExternalsBuilderState = state[EXTERNALS_BUILDER_STATE_KEY];
	if (s === undefined) {
		s = state[EXTERNALS_BUILDER_STATE_KEY] = {specifiers: [], timeout: null, installing: null};
	}
	return s;
};
