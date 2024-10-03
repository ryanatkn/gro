import {EMPTY_OBJECT} from '@ryanatkn/belt/object.js';
import {existsSync, readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import type {Omit_Strict} from '@ryanatkn/belt/types.js';
import {wait} from '@ryanatkn/belt/async.js';

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
import {Unreachable_Error} from '@ryanatkn/belt/error.js';

const aliases = Object.entries(default_sveltekit_config.alias);

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
	watch_dir_options?: Partial<Omit_Strict<Watch_Dir_Options, 'on_change'>>;
}

export class Filer {
	files: Map<Path_Id, Source_File> = new Map();

	#watch_dir: typeof watch_dir;
	#watch_dir_options: Partial<Watch_Dir_Options>;

	constructor(options: Options = EMPTY_OBJECT) {
		this.#watch_dir = options.watch_dir ?? watch_dir;
		this.#watch_dir_options = options.watch_dir_options ?? EMPTY_OBJECT;
	}

	#watching: Watch_Node_Fs | undefined;
	#listeners: Set<On_Filer_Change> = new Set();

	#ready = false;

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

	#update(id: Path_Id): Source_File {
		console.log('[filer] #update', id);
		const file = this.get_or_create(id);
		const new_contents = existsSync(id) ? readFileSync(id, 'utf8') : null;
		const contents_changed = file.contents !== new_contents;
		file.contents = new_contents;

		if (contents_changed) {
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
						d.dependents.set(file.id, file);
					}
				}
			}

			// update any removed dependencies
			for (const dependency_removed of dependencies_removed) {
				console.log(`dependency_removed`, dependency_removed);
				const deleted1 = file.dependencies.delete(dependency_removed);
				if (!deleted1) throw Error('expected to delete1 ' + file.id); // TODO @many delete if correct
				const dependency_removed_file = this.get_or_create(dependency_removed);
				const deleted2 = dependency_removed_file.dependents.delete(file.id);
				if (!deleted2) throw Error('expected to delete2 ' + file.id); // TODO @many delete if correct
			}
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

		return file;
	}

	#remove(id: Path_Id): Source_File | undefined {
		console.log('[filer] #remove', id);
		const file = this.get_by_id(id);
		if (!file) return; // this is safe because the object would exist if any other file referenced it as a dependency or dependent

		file.contents = null; // clear contents in case it gets re-added later, we want the change to be detected

		console.log('[filer] #remove_references', file.id, Array.from(file.dependencies.keys()));

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

	#notify_listener(listener: On_Filer_Change): void {
		console.log('[filer] #notify');
		if (!this.#ready) return;
		for (const source_file of this.files.values()) {
			listener({type: 'add', path: source_file.id, is_directory: false}, source_file);
		}
	}

	#notify_change(change: Watcher_Change, source_file: Source_File): void {
		console.log('[filer] #notify_change', change, source_file.id);
		if (!this.#ready) return;
		for (const listener of this.#listeners) {
			listener(change, source_file);
		}
	}

	async #add_listener(listener: On_Filer_Change): Promise<void> {
		this.#listeners.add(listener);
		if (this.#watching) {
			// if already watching, call the listener for all existing files after init
			await this.#watching.init();
			await wait(); // wait a tick to ensure the `this.#ready` value is updated below first
			this.#notify_listener(listener);
			return;
		}
		this.#watching = this.#watch_dir({
			filter: (path, is_directory) => (is_directory ? true : default_file_filter(path)),
			...this.#watch_dir_options,
			dir: resolve(this.#watch_dir_options.dir ?? paths.source),
			on_change: this.#on_change,
		});
		await this.#watching.init();
		this.#ready = true;
		this.#notify_listener(listener);
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
		if (change.is_directory) return;
		console.log(`[filer] #on_change`, change);
		// TODO BLOCK the init problem has an interesting angle, in that if the contents don't change on disk, we can ignore the change UNLESS it's initiing (maybe add `#ready` back?)
		let source_file: Source_File | undefined;
		switch (change.type) {
			case 'add':
			case 'update': {
				source_file = this.#update(change.path);
				break;
			}
			case 'delete': {
				source_file = this.#remove(change.path);
				break;
			}
			default:
				throw new Unreachable_Error(change.type);
		}
		if (source_file) {
			this.#notify_change(change, source_file);
		}
	};

	async watch(listener: On_Filer_Change): Promise<Cleanup_Watch> {
		console.log('[filer] watch');
		await this.#add_listener(listener);
		return () => this.#remove_listener(listener);
	}

	async close(): Promise<void> {
		console.log('[filer] close');
		this.#ready = false;
		this.#listeners.clear();
		if (this.#watching) {
			await this.#watching.close();
			this.#watching = undefined;
		}
	}
}
