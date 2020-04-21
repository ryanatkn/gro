import {resolve, join} from 'path';
import fs from 'fs-extra';

import {blue, magenta} from '../colors/terminal.js';
import {NodeTestContext} from '../oki/node/NodeTestContext.js';
import {SystemLogger} from '../utils/log.js';
import {omitUndefined} from '../utils/object.js';
import {toPathParts, toInferredId, toBasePath, toBuildId} from '../paths.js';

const {info} = new SystemLogger([blue(`[commands/${magenta('test')}]`)]);

const DEFAULT_DIR = './build';

export interface Options {
	_: string[]; // optional array of paths
	dir: string;
	watch: boolean;
}
export type RequiredOptions = '_';
export type InitialOptions = PartialExcept<Options, RequiredOptions>;
export const initOptions = (opts: InitialOptions): Options => ({
	watch: false,
	...omitUndefined(opts),
	dir: resolve(opts.dir || DEFAULT_DIR),
});

export const run = async (opts: InitialOptions): Promise<void> => {
	const options = initOptions(opts);
	info('options', options);
	const {_: rawPaths, dir, watch} = options;

	const basePaths = rawPaths.map(path =>
		toBasePath(toBuildId(toInferredId(path))),
	);
	checkPaths(dir, basePaths);

	const pathsAndDirs = toPathsAndDirs(basePaths);

	const testContext = new NodeTestContext({
		dir,
		filter: pathsAndDirs.size ? ({path}) => pathsAndDirs.has(path) : undefined,
		watch,
	});
	await testContext.init();
	await testContext.run();

	// ...
};

const checkPaths = (dir: string, rawPaths: string[]): string[] => {
	const paths = rawPaths.map(f => join(dir, f));
	for (const path of paths) {
		if (!fs.existsSync(path)) {
			throw Error(`Path not found: ${path}`);
		}
	}
	return paths;
};

const toPathsAndDirs = (rawPaths: string[]): Set<string> => {
	const results = new Set<string>();
	for (const rawPath of rawPaths) {
		for (const path of toPathParts(rawPath)) {
			results.add(path);
		}
	}
	return results;
};
