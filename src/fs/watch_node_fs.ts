import CheapWatch from 'cheap-watch';
import {omit_undefined} from '@feltcoop/felt/utils/object.js';
import type {Partial_Except} from '@feltcoop/felt/utils/types.js';

import type {Path_Stats} from './path_data.js';
import {toPath_Filter} from './path_filter.js';
import type {Path_Filter} from './path_filter.js';
import {loadGitignoreFilter} from '../utils/gitignore.js';

/*

`watchNodeFs` is Gro's low level interface for watching changes on the Node filesystem.
`Filer` is a high level interface that should be preferred when possible.

*/

export interface WatchNodeFs {
	init: () => Promise<Map<string, Path_Stats>>;
	close: () => void;
}

export interface WatcherChange {
	type: WatcherChangeType;
	path: string;
	stats: Path_Stats;
}
export type WatcherChangeType = 'create' | 'update' | 'delete';
export interface WatcherChangeCallback {
	(change: WatcherChange): void;
}

export const DEBOUNCE_DEFAULT = 10;

export interface Options {
	dir: string;
	onChange: WatcherChangeCallback;
	filter: Path_Filter | null | undefined;
	watch: boolean;
	debounce: number;
}
export type Required_Options = 'dir' | 'onChange';
export type Initial_Options = Partial_Except<Options, Required_Options>;
export const init_options = (opts: Initial_Options): Options => ({
	watch: true,
	debounce: DEBOUNCE_DEFAULT,
	...omit_undefined(opts),
	filter: opts.filter === undefined ? toDefaultFilter() : opts.filter,
});

export const watchNodeFs = (opts: Initial_Options): WatchNodeFs => {
	const {dir, onChange, filter, debounce, watch} = init_options(opts);
	const watcher = new CheapWatch({dir, filter, watch, debounce});
	if (watch) {
		watcher.on('+', ({path, stats, isNew}) => {
			onChange({type: isNew ? 'create' : 'update', path, stats});
		});
		watcher.on('-', ({path, stats}) => {
			onChange({type: 'delete', path, stats});
		});
	}
	return {
		init: async () => {
			await watcher.init();
			return watcher.paths;
		},
		close: () => {
			watcher.close();
			watcher.removeAllListeners();
		},
	};
};

const toDefaultFilter = (): Path_Filter => toPath_Filter(loadGitignoreFilter());
