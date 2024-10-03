import {EMPTY_OBJECT} from '@ryanatkn/belt/object.js';
import {existsSync, readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';

import type {Path_Id} from './path.js';
import {
	watch_dir,
	type Watch_Node_Fs,
	type Watcher_Change,
	type Options as Watch_Dir_Options,
	type Watcher_Change_Callback,
} from './watch_dir.js';
import {default_file_filter, paths} from './paths.js';
import {parse_imports} from './parse_imports.js';
import {resolve_specifier} from './resolve_specifier.js';
import {default_sveltekit_config} from './sveltekit_config.js';
import {map_sveltekit_aliases} from './sveltekit_helpers.js';

// TODO BLOCK hacky
const aliases = Object.entries({$lib: 'src/lib', ...default_sveltekit_config.alias});

export interface Source_File {
	id: Path_Id;
	/**
	 * `null` contents means it doesn't exist.
	 * We create the file in memory to track its dependents regardless of its existence on disk.
	 */
	contents: string | null;
	dependents: Map<Path_Id, Source_File>;
	dependencies: Map<Path_Id, Source_File>;
}

export type Cleanup_Watch = () => Promise<void>;

export type On_Filer_Change = (change: Watcher_Change, source_file: Source_File) => void;

export interface Options {
	watch_dir?: typeof watch_dir;
	watch_dir_options?: Partial<Watch_Dir_Options>;
}

// TODO BLOCK use `watch_dir` - maybe also `search_fs` for non-watch cases? do we have any of those?
// TODO BLOCK lazy init - should be able to create the class without doing any significant work
export class Filer {
	files: Map<Path_Id, Source_File> = new Map();

	#watch_dir: typeof watch_dir;
	#watch_dir_options: Partial<Watch_Dir_Options>;

	constructor(options: Options = EMPTY_OBJECT) {
		this.#watch_dir = options.watch_dir ?? watch_dir;
		this.#watch_dir_options = options.watch_dir_options ?? EMPTY_OBJECT;
	}

	// TODO BLOCK program reactively? maybe as a followup?
	#watching: Watch_Node_Fs | undefined;
	#listeners: Set<On_Filer_Change> = new Set();

	get_by_id = (id: Path_Id): Source_File | undefined => {
		return this.files.get(id);
	};

	get_or_create = (id: Path_Id): Source_File => {
		const existing = this.get_by_id(id);
		if (existing) return existing;
		const file: Source_File = {
			id,
			contents: null,
			dependents: new Map(),
			dependencies: new Map(),
		};
		this.files.set(id, file);
		return file;
	};

	// TODO BLOCK this isn't an id, it's relative, same with `source_file.id` below
	#update(id: Path_Id): Source_File {
		console.log('[filer] #update', id);
		const file = this.get_or_create(id);
		file.contents = existsSync(id) ? readFileSync(id, 'utf8') : null;

		// TODO BLOCK resolve specifiers - `resolve_specifier` and `resolve_node_specifier`
		// TODO BLOCK handle existing?

		this.#sync_deps_for_file(file);

		return file;
	}

	#remove(id: Path_Id): Source_File | undefined {
		console.log('[filer] #remove', id);
		const file = this.get_by_id(id);
		if (!file) return; // this is safe because the object would exist if any other file referenced it as a dependency or dependent

		console.log('[filer] #remove_references', file.id);
		for (const d of file.dependencies.values()) {
			const deleted = d.dependents.delete(file.id);
			if (!deleted) throw Error('TODO expected deleted'); // TODO @many delete if correct
		}
		// TODO @many delete if correct
		for (const d of this.files.values()) {
			if (d.dependents.has(file.id)) throw Error('TODO should have cleaned up dependent');
		}

		let found = false;
		for (const d of this.files.values()) {
			if (d.dependencies.has(file.id)) {
				found = true;
				break;
			}
		}
		console.log('found is ', found, found ? 'so not removing' : 'so removing');
		if (!found) this.files.delete(id);

		return file;
	}

	#sync_deps_for_file(file: Source_File): void {
		console.log('[filer] #sync_deps_for_file', file.id);
		const dir = dirname(file.id);

		const dependencies_before = new Set(file.dependencies.keys());
		const dependencies_removed = new Set(dependencies_before);

		const imported = file.contents ? parse_imports(file.id, file.contents) : [];
		for (const specifier of imported) {
			// TODO logic is duplicated from loader
			const path = map_sveltekit_aliases(specifier, aliases);

			// The specifier `path` has now been mapped to its final form, so we can inspect it.
			if (path[0] === '.' || path[0] === '/') {
				const {path_id} = resolve_specifier(path, dir);
				dependencies_removed.delete(path_id);
				if (!dependencies_before.has(path_id)) {
					const d = this.get_or_create(path_id);
					file.dependencies.set(d.id, d);
				}
			}
		}

		for (const dependency_removed of dependencies_removed) {
			console.log(`dependency_removed`, dependency_removed);
			const deleted1 = file.dependencies.delete(dependency_removed);
			if (!deleted1) throw Error('expected to delete1 ' + file.id); // TODO @many delete if correct
			const dependency_removed_file = this.get_or_create(dependency_removed);
			const deleted2 = dependency_removed_file.dependents.delete(file.id);
			if (!deleted2) throw Error('expected to delete2 ' + file.id); // TODO @many delete if correct
		}

		// add the back refs
		for (const d of file.dependencies.values()) {
			d.dependents.set(file.id, file);
		}

		console.log(
			`[filer] synced file id, dependencies, dependents`,
			file.id,
			Array.from(file.dependencies.keys()),
			Array.from(file.dependents.keys()),
		);
		// console.log(
		// 	`file.dependencies, file.dependents`,
		// 	Array.from(file.dependencies.keys()),
		// 	Array.from(file.dependents.keys()),
		// );
	}

	#notify(listener: On_Filer_Change): void {
		console.log('[filer] #notify');
		for (const source_file of this.files.values()) {
			listener({type: 'add', path: source_file.id, is_directory: false}, source_file);
		}
	}

	async #add_listener(listener: On_Filer_Change): Promise<void> {
		this.#listeners.add(listener);
		if (this.#watching) {
			// if already watching, call the listener for all existing files
			await this.#watching.init();
			this.#notify(listener);
			return;
		}
		this.#watching = this.#watch_dir({
			filter: (path, is_directory) => (is_directory ? true : default_file_filter(path)),
			...this.#watch_dir_options,
			dir: resolve(this.#watch_dir_options.dir ?? paths.source),
			on_change: this.#on_change,
		}); // TODO maybe make `watch_dir` an option instead of accepting options?
		await this.#watching.init();
		console.log('[filer] [#add_listener] READY');
	}

	async #remove_listener(listener: On_Filer_Change): Promise<void> {
		console.log('[filer] #remove_listener');
		this.#listeners.delete(listener);
		if (this.#listeners.size === 0) {
			await this.close(); // TODO is this right? should `watch` be async?
		}
	}

	#on_change: Watcher_Change_Callback = (change) => {
		if (this.#watch_dir_options.on_change) throw Error('TODO'); // TODO BLOCK call into it? where? or exclude from the type?
		if (change.is_directory) return;
		console.log(`[filer] #on_change`, change);
		// TODO BLOCK the init problem has an interesting angle, in that if the contents don't change on disk, we can ignore the change UNLESS it's initiing (maybe add `#ready` back?)
		let source_file: Source_File | undefined;
		switch (change.type) {
			case 'add':
			case 'update': {
				// TODO BLOCK add_or_update? check here or in the fn?
				// TODO BLOCK check if content changed, efficient if not
				source_file = this.#update(change.path);
				break;
			}
			case 'delete': {
				source_file = this.#remove(change.path);
				break;
			}
		}
		// TODO BLOCK problem is notifying here on startup doesn't have all deps ready
		// TODO BLOCK should this always be called even with an `undefined` source file?
		if (source_file) {
			for (const listener of this.#listeners) {
				listener(change, source_file);
			}
		}
	};

	async watch(listener: On_Filer_Change): Promise<Cleanup_Watch> {
		console.log('[filer] watch');
		await this.#add_listener(listener);
		return () => this.#remove_listener(listener);
	}

	async close(): Promise<void> {
		console.log('[filer] close');
		this.#listeners.clear();
		if (this.#watching) {
			await this.#watching.close();
			this.#watching = undefined;
		}
	}
}
