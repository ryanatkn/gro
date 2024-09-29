import {EMPTY_OBJECT} from '@ryanatkn/belt/object.js';

import type {Path_Id} from './path.js';
import {
	watch_dir,
	type Watch_Node_Fs,
	type Watcher_Change,
	type Options as Watch_Dir_Options,
} from './watch_dir.js';
import {SOURCE_DIR} from './path_constants.js';

export interface Source_File {
	id: Path_Id;
	contents: string;
	dependents: Map<Path_Id, Source_File>; // TODO BLOCK dependents and dependencies?
}

export type Cleanup_Watch = () => void;

export type On_Filer_Change = (change: Watcher_Change, source_file: Source_File) => void;

export interface Options {
	watch_dir_options?: Partial<Watch_Dir_Options>;
}

// TODO BLOCK use `watch_dir` - maybe also `search_fs` for non-watch cases? do we have any of those?
// TODO BLOCK lazy init - should be able to create the class without doing any significant work
export class Filer {
	files: Map<Path_Id, Source_File> = new Map();

	watcher: Watch_Node_Fs | undefined;
	watch_dir_options: Partial<Watch_Dir_Options>;

	constructor(options: Options = EMPTY_OBJECT) {
		this.watch_dir_options = options.watch_dir_options ?? EMPTY_OBJECT;
	}

	// TODO BLOCK program reactively? maybe as a followup?
	#watching: Watch_Node_Fs | undefined;
	// TODO BLOCK rename?
	#update_watcher() {
		if (this.#watching) return;
		this.#watching = watch_dir({
			dir: SOURCE_DIR,
			filter: (path, is_directory) => {
				// TODO BLOCK filter ts/json/svelte like in zzz_wip
			},
			...this.watch_dir_options,
			on_change: this.on_change,
		}); // TODO maybe make `watch_dir` an option instead of accepting options?
	}

	get_by_id = (id: Path_Id): Source_File | undefined => {
		return this.files.get(id);
	};

	add = (id: Path_Id, contents: string): Source_File => {
		// TODO BLOCK resolve specifiers - `resolve_specifier` and `resolve_node_specifier`
		// TODO BLOCK handle existing?
		const source_file: Source_File = {
			id,
			contents,
			dependents: new Map(),
		};
		this.files.set(id, source_file);
		return source_file;
	};

	remove = (id: Path_Id): Source_File | undefined => {
		const found = this.get_by_id(id);
		if (!found) return undefined;
		// TODO BLOCK remove from dependents
		this.files.delete(id);
		return found;
	};

	#listeners: Set<On_Filer_Change> = new Set();

	watch = (listener: On_Filer_Change): Cleanup_Watch => {
		this.#listeners.add(listener);
		this.#update_watcher();
		return () => {
			this.#listeners.delete(listener);
		};
	};

	close = async (): Promise<void> => {
		this.#listeners.clear();
		await this.watcher?.close();
		if (this.#watching) {
			await this.#watching.close();
			this.#watching = undefined;
		}
	};
}
