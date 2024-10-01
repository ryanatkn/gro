import {watch, type ChokidarOptions, type FSWatcher} from 'chokidar';
import {relative} from 'node:path';
import {statSync} from 'node:fs';

import type {Path_Filter} from './path.js';

// TODO pretty hacky

export interface Watch_Node_Fs {
	init: () => Promise<void>;
	close: () => Promise<void>;
}

export interface Watcher_Change {
	type: Watcher_Change_Type;
	path: string;
	is_directory: boolean;
}
export type Watcher_Change_Type = 'add' | 'update' | 'delete'; // TODO BLOCK `init` instead of `create`?
export type Watcher_Change_Callback = (change: Watcher_Change) => void;

export interface Options {
	dir: string;
	on_change: Watcher_Change_Callback;
	filter?: Path_Filter | null | undefined;
	chokidar?: ChokidarOptions;
	/**
	 * When `false`, returns the `path` relative to `dir`.
	 * @default true
	 */
	absolute?: boolean;
}

/**
 * Watch for changes on the filesystem using chokidar.
 */
export const watch_dir = ({
	dir,
	on_change,
	filter,
	absolute = true,
	chokidar,
}: Options): Watch_Node_Fs => {
	let watcher: FSWatcher | undefined;
	let initing: Promise<void> | undefined;

	return {
		init: async () => {
			if (initing) return initing;
			let resolve: any;
			initing = new Promise((r) => (resolve = r)); // TODO `create_deferred`?// cwd: chokidar?.cwd ?? process.cwd()
			watcher = watch(dir, {...chokidar});
			watcher.on('add', (path) => {
				const final_path = absolute ? path : relative(dir, path);
				if (filter && !filter(final_path, false)) return;
				on_change({type: 'add', path: final_path, is_directory: false});
			});
			watcher.on('addDir', (path) => {
				const final_path = absolute ? path : relative(dir, path);
				if (filter && !filter(final_path, true)) return;
				on_change({type: 'add', path: final_path, is_directory: true});
			});
			watcher.on('change', (path, s) => {
				const stats = s ?? statSync(path);
				const final_path = absolute ? path : relative(dir, path);
				if (filter && !filter(final_path, stats.isDirectory())) return;
				on_change({type: 'update', path: final_path, is_directory: stats.isDirectory()});
			});
			watcher.on('unlink', (path) => {
				const final_path = absolute ? path : relative(dir, path);
				if (filter && !filter(final_path, false)) return;
				on_change({type: 'delete', path: final_path, is_directory: false});
			});
			watcher.on('unlinkDir', (path) => {
				const final_path = absolute ? path : relative(dir, path);
				if (filter && !filter(final_path, true)) return;
				on_change({type: 'delete', path: final_path, is_directory: true});
			});
			// wait until ready
			watcher.once('ready', () => resolve());
			await initing;
		},
		close: async () => {
			initing = undefined;
			if (!watcher) return;
			await watcher.close();
		},
	};
};
