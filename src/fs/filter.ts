import {join} from 'path';

import {paths} from '../paths.js';
import type {Path_Stats} from 'src/fs/path_data.js';

// This is a subset of the `cheap-watch` types designed for browser compatibility.
export interface Path_Filter {
	(file: {path: string; stats: Path_Stats}): boolean;
}

export const to_path_filter =
	(exclude: Id_Stats_Filter, root = paths.root): Path_Filter =>
	({path, stats}) =>
		!exclude(join(root, path), stats);

export interface Id_Stats_Filter {
	(id: string, stats: Path_Stats): boolean;
}

export interface Id_Filter {
	(id: string): boolean;
}
