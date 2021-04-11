import {join} from 'path';

import {paths} from '../paths.js';
import type {FileFilter} from './file.js';
import type {PathStats} from './pathData.js';

// This is a subset of the `cheap-watch` types designed for browser compatibility.
export interface PathFilter {
	(file: {path: string; stats: PathStats}): boolean;
}

export const toPathFilter = (filter: FileFilter, root = paths.root): PathFilter => ({path}) =>
	!filter(join(root, path));
