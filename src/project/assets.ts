import {join} from 'path';

import {magenta} from '../colors/terminal.js';
import {copy} from '../fs/nodeFs.js';
import {SystemLogger, Logger} from '../utils/log.js';
import {omitUndefined} from '../utils/object.js';
import {findFiles} from '../fs/nodeFs.js';
import {paths, toDistId, SOURCE_DIR_NAME, BUILD_DIR_NAME, SOURCE_DIR, BUILD_DIR} from '../paths.js';
import {printPath} from '../utils/print.js';

// TODO needs major refactoring
// - how does it work with the build process instead of as a standalone script?
// - how should imported assets be handled?

export const DEFAULT_ASSET_MATCHER = /\.(jpg|png|ico|html)$/;

export interface Options {
	isAsset: (path: string) => boolean;
}
export type InitialOptions = Partial<Options>;
export const initOptions = (opts: InitialOptions): Options => ({
	isAsset: (path) => DEFAULT_ASSET_MATCHER.test(path),
	...omitUndefined(opts),
});

export const assets = async (opts: InitialOptions = {}) => {
	const options = initOptions(opts);
	const {isAsset} = options;
	const log = new SystemLogger([magenta('[assets]')]);

	// Start in the root dir because assets can be in either `src/` or `.gro/`.
	const dir = paths.root;

	const files = await findFiles(
		dir,
		({path, stats}) => {
			// TODO maybe make regexps for these?
			const shouldWatch = stats.isDirectory()
				? path.startsWith(SOURCE_DIR) ||
				  path.startsWith(BUILD_DIR) ||
				  path === SOURCE_DIR_NAME ||
				  path === BUILD_DIR_NAME
				: isAsset(path) && (path.startsWith(SOURCE_DIR) || path.startsWith(BUILD_DIR));
			return shouldWatch;
		},
		null,
	);

	const promises = [];
	for (const [path, stats] of files) {
		if (stats.isDirectory()) continue;
		const id = join(dir, path);
		promises.push(copyAssetToDist(id, log));
	}
	if (promises.length) {
		await Promise.all(promises);
		log.info('assets copied!');
	}
};

const copyAssetToDist = async (id: string, log: Logger): Promise<void> => {
	const distId = toDistId(id);
	log.info('copying asset', printPath(id), 'to', printPath(distId));
	return copy(id, distId);
};
