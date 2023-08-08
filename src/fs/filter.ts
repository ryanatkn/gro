import {join} from 'node:path';

import {paths} from '../paths.js';
import type {PathStats} from './pathData.js';

// exists for browser compatibility
// TODO BLOCK change this to be 2 args
export interface PathFilter {
	(file: {path: string; stats: PathStats}): boolean;
}

export const toPathFilter =
	(exclude: IdStatsFilter, root = paths.root): PathFilter =>
	({path, stats}) =>
		!exclude(join(root, path), stats);

export interface IdStatsFilter {
	(id: string, stats: PathStats): boolean;
}

export interface IdFilter {
	(id: string): boolean;
}
