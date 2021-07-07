import {join} from 'path';

import {paths} from '../paths.js';
import type {File_Filter} from './file.js';
import type {Path_Stats} from './path_data.js';

// This is a subset of the `cheap-watch` types designed for browser compatibility.
export interface Path_Filter {
	(file: {path: string; stats: Path_Stats}): boolean;
}

export const to_path_filter =
	(exclude: File_Filter, root = paths.root): Path_Filter =>
	({path}) =>
		!exclude(join(root, path));
