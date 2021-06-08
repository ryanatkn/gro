import {join} from 'path';

import {paths} from '../paths.js';
import type {FileFilter} from './file.js';
import type {Path_Stats} from './path_data.js';

// This is a subset of the `cheap-watch` types designed for browser compatibility.
export interface PathFilter {
	(file: {path: string; stats: Path_Stats}): boolean;
}

export const toPathFilter = (exclude: FileFilter, root = paths.root): PathFilter => ({path}) =>
	!exclude(join(root, path));
