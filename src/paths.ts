import {join} from 'path';
import {gray} from 'kleur';

import {resolvePath} from './utils/pathUtils';
import {logger, LogLevel} from './utils/logger';

const {info} = logger(LogLevel.Info, [gray('[paths]')]); // TODO log level from env var? param?

const createPaths = () => {
	const root = resolvePath('./');
	const src = join(root, 'src');
	const build = join(root, 'build');
	return {
		root,
		src,
		build,
	};
};

export const paths = createPaths();
info(paths);

// TODO this helper is bleh
export const toRootPath = (path: string): string =>
	path.startsWith(paths.root) ? path.slice(paths.root.length + 1) : path;
