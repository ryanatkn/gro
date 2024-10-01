import {EMPTY_OBJECT} from '@ryanatkn/belt/object.js';
import {readFileSync} from 'fs';
import {dirname, join, resolve} from 'node:path';
import {parse} from 'es-module-lexer';

import type {Path_Id} from './path.js';
import {
	watch_dir,
	type Watch_Node_Fs,
	type Watcher_Change,
	type Options as Watch_Dir_Options,
	type Watcher_Change_Callback,
} from './watch_dir.js';
import {default_file_filter, paths} from './paths.js';
import {TS_MATCHER} from './path_constants.js';
import {SVELTE_MATCHER} from './svelte_helpers.js';
import {parse_imports} from './parse_imports.js';
import {resolve_specifier} from './resolve_specifier.js';
import {default_sveltekit_config} from './sveltekit_config.js';
import {map_sveltekit_aliases} from './sveltekit_helpers.js';

// TODO BLOCK hacky
const aliases = Object.entries({$lib: 'src/lib', ...default_sveltekit_config.alias});

export interface Source_File {
	id: Path_Id;
	contents: string;
	dependents: Map<Path_Id, Source_File>; // TODO BLOCK dependents and dependencies?
	dependencies: Map<Path_Id, Source_File>; // TODO BLOCK dependents and dependencies?
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

	// TODO BLOCK this isn't an id, it's relative, same with `source_file.id` below
	#update(id: Path_Id): Source_File {
		const contents = readFileSync(id, 'utf8');
		const existing = this.get_by_id(id);
		if (existing) {
			existing.contents = contents; // TODO BLOCK update dependencies (make `Source_File` a class?)
			// TODO BLOCK update contents
			return existing;
		}
		// TODO BLOCK resolve specifiers - `resolve_specifier` and `resolve_node_specifier`
		// TODO BLOCK handle existing?
		const file: Source_File = {
			id,
			contents,
			dependents: new Map(), // TODO BLOCK use the lexer
			dependencies: new Map(), // TODO BLOCK use the lexer
		};
		this.files.set(id, file);
		if (this.#ready) {
			this.#sync_deps_for_file(file);
		}
		return file;
	}

	#remove(id: Path_Id): Source_File | undefined {
		const found = this.get_by_id(id);
		if (!found) return undefined;
		// TODO BLOCK remove from dependents
		this.files.delete(id);
		if (this.#ready) {
			// TODO BLOCK different sync logic?
		}
		return found;
	}

	// syncs all deps, clearing as it goes
	#sync_deps(): void {
		for (const file of this.files.values()) {
			this.#sync_deps_for_file(file);
		}
	}

	#sync_deps_for_file(file: Source_File): void {
		const dir = dirname(file.id);
		// TODO BLOCK parse deps for TS/svelte
		const imported = parse_imports(file.id, file.contents);
		for (const specifier of imported) {
			// TODO BLOCK duplicated from loader
			const path = map_sveltekit_aliases(specifier, aliases);

			// The specifier `path` has now been mapped to its final form, so we can inspect it.
			if (path[0] === '.' || path[0] === '/') {
				const resolved = resolve_specifier(path, dir);
				const f = this.get_by_id(resolved.path_id);
				if (!f) {
					throw Error('expected to find ' + resolved.path_id);
				}
				file.dependencies.set(f.id, f);
			}
		}

		// add the back refs
		// TODO BLOCK remove existing back refs
		for (const d of file.dependencies.values()) {
			d.dependents.set(file.id, file);
		}
		// console.log(
		// 	`file.dependencies, file.dependents`,
		// 	Array.from(file.dependencies.keys()),
		// 	Array.from(file.dependents.keys()),
		// );
	}

	#notify(listener: On_Filer_Change): void {
		for (const source_file of this.files.values()) {
			listener({type: 'add', path: source_file.id, is_directory: false}, source_file);
		}
	}

	/**
	 * File deps need to be initialized in a batch after all file references are ready.
	 * This flag is set to `true` after all deps have been batch-synced.
	 * When it's not ready, events do not need to modify deps, and indeed they shouldn't,
	 * because any particular file objects may not be ready yet.
	 */
	#ready = false;

	async #add_listener(listener: On_Filer_Change): Promise<void> {
		this.#listeners.add(listener);
		if (this.#watching) {
			// if already watching, call the listener for all existing files
			await this.#watching.init();
			this.#notify(listener);
			return;
		}
		this.#watching = watch_dir({
			filter: (path, is_directory) => (is_directory ? true : default_file_filter(path)),
			...this.watch_dir_options,
			dir: resolve(this.watch_dir_options.dir ?? paths.source),
			on_change: this.#on_change,
		}); // TODO maybe make `watch_dir` an option instead of accepting options?
		await this.#watching.init();
		this.#sync_deps();
		this.#ready = true;
		// TODO BLOCK here we need to now set up all dependencies now that all files exist
		console.log('[#add_listener] this.#watching.init() COMPLETED');
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
			case 'add':
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
		this.#ready = false;
		this.#listeners.clear();
		if (this.#watching) {
			await this.#watching.close();
			this.#watching = undefined;
		}
	};
}
