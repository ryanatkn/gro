import {join} from 'path';

import {paths} from '../paths.js';
import type {FileFilter} from './file.js';
import type {Path_Stats} from './path_data.js';

// This is a subset of the `cheap-watch` types designed for browser compatibility.
export interface Path_Filter {
	(file: {path: string; stats: Path_Stats}): boolean;
}

export const toPath_Filter = (exclude: FileFilter, root = paths.root): Path_Filter => ({path}) =>
	!exclude(join(root, path));
