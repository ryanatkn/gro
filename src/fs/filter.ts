import {join} from 'path';

import {paths} from '../paths.js';
import type {PathStats} from 'src/fs/path_data.js';

// This is a subset of the `cheap-watch` types designed for browser compatibility.
export interface PathFilter {
	(file: {path: string; stats: PathStats}): boolean;
}

export const to_path_filter =
	(exclude: IdStatsFilter, root = paths.root): PathFilter =>
	({path, stats}) =>
		!exclude(join(root, path), stats);

export interface IdStatsFilter {
	(id: string, stats: PathStats): boolean;
}

export interface IdFilter {
	(id: string): boolean;
}
