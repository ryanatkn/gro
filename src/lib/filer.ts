import {EMPTY_OBJECT} from '@ryanatkn/belt/object.js';

import type {Path_Id} from './path.js';
import {
	watch_dir,
	type Watch_Node_Fs,
	type Watcher_Change,
	type Options as Watch_Dir_Options,
	type Watcher_Change_Callback,
} from './watch_dir.js';
import {SOURCE_DIR} from './path_constants.js';
import {default_file_filter} from './paths.js';
import {readFileSync} from 'fs';

export interface Source_File {
	id: Path_Id;
	contents: string;
	dependents: Map<Path_Id, Source_File>; // TODO BLOCK dependents and dependencies?
}

export type Cleanup_Watch = () => Promise<void>;

export type On_Filer_Change = (change: Watcher_Change, source_file: Source_File) => void;

export interface Options {
	watch_dir_options?: Partial<Watch_Dir_Options>;
}

// TODO BLOCK use `watch_dir` - maybe also `search_fs` for non-watch cases? do we have any of those?
// TODO BLOCK lazy init - should be able to create the class without doing any significant work
export class Filer {
	files: Map<Path_Id, Source_File> = new Map();

	watch_dir_options: Partial<Watch_Dir_Options>;

	constructor(options: Options = EMPTY_OBJECT) {
		this.watch_dir_options = options.watch_dir_options ?? EMPTY_OBJECT;
	}

	// TODO BLOCK program reactively? maybe as a followup?
	#watching: Watch_Node_Fs | undefined;
	#listeners: Set<On_Filer_Change> = new Set();

	get_by_id = (id: Path_Id): Source_File | undefined => {
		return this.files.get(id);
	};

	#update(id: Path_Id): Source_File {
		const contents = readFileSync(id, 'utf8');
		const existing = this.get_by_id(id);
		if (existing) {
			existing.contents = contents; // TODO BLOCK update dependencies (make `Source_File` a class?)
			return existing;
		}
		// TODO BLOCK resolve specifiers - `resolve_specifier` and `resolve_node_specifier`
		// TODO BLOCK handle existing?
		const source_file: Source_File = {
			id,
			contents,
			dependents: new Map(), // TODO BLOCK use the lexer - maybe `dependencies` too?
		};
		this.files.set(id, source_file);
		return source_file;
	}

	#remove(id: Path_Id): Source_File | undefined {
		const found = this.get_by_id(id);
		if (!found) return undefined;
		// TODO BLOCK remove from dependents
		this.files.delete(id);
		return found;
	}

	async #add_listener(listener: On_Filer_Change): Promise<void> {
		this.#listeners.add(listener);
		// TODO BLOCK if already watching, call the listener for all existing files?
		if (this.#watching) return;
		console.log('ADD LISTENER', SOURCE_DIR);
		this.#watching = watch_dir({
			dir: SOURCE_DIR, // TODO BLOCK option
			filter: (path, is_directory) => (is_directory ? true : default_file_filter(path)),
			...this.watch_dir_options,
			on_change: this.#on_change,
		}); // TODO maybe make `watch_dir` an option instead of accepting options?
		await this.#watching.init(); // TODO return?
	}

	async #remove_listener(listener: On_Filer_Change): Promise<void> {
		this.#listeners.delete(listener);
		if (this.#listeners.size === 0) {
			await this.close(); // TODO is this right? should `watch` be async?
		}
	}

	#on_change: Watcher_Change_Callback = (change) => {
		if (this.watch_dir_options.on_change) throw Error('TODO'); // TODO BLOCK call into it? where? or exclude from the type?
		if (change.is_directory) return;
		let source_file: Source_File | undefined;
		switch (change.type) {
			case 'create':
			case 'update': {
				// TODO BLOCK add_or_update? check here or in the fn?
				source_file = this.#update(change.path);
				break;
			}
			case 'delete': {
				source_file = this.#remove(change.path);
				break;
			}
		}
		// TODO BLOCK should this always be called even with an `undefined` source file?
		if (source_file) {
			for (const listener of this.#listeners) {
				listener(change, source_file);
			}
		}
	};

	watch = async (listener: On_Filer_Change): Promise<Cleanup_Watch> => {
		console.log('FILER WATCH');
		await this.#add_listener(listener);
		return () => this.#remove_listener(listener);
	};

	close = async (): Promise<void> => {
		console.log('FILER CLOSE');
		this.#listeners.clear();
		if (this.#watching) {
			await this.#watching.close();
			this.#watching = undefined;
		}
	};
}
