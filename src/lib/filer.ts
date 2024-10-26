import {EMPTY_OBJECT} from '@ryanatkn/belt/object.js';
import {existsSync, readFileSync, statSync} from 'node:fs';
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
import {paths} from './paths.js';
import {parse_imports} from './parse_imports.js';
import {resolve_specifier} from './resolve_specifier.js';
import {default_sveltekit_config} from './sveltekit_config.js';
import {map_sveltekit_aliases} from './sveltekit_helpers.js';
import {Unreachable_Error} from '@ryanatkn/belt/error.js';
import {resolve_node_specifier} from './resolve_node_specifier.js';
// TODO see below
// import {resolve_node_specifier} from './resolve_node_specifier.js';

const aliases = Object.entries(default_sveltekit_config.alias);

export interface Source_File {
	id: Path_Id;
	// TODO add // mtime: number;
	/**
	 * `null` contents means it doesn't exist.
	 * We create the file in memory to track its dependents regardless of its existence on disk.
	 */
	contents: string | null;
	ctime: number | null;
	mtime: number | null;
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
	readonly root_dir: Path_Id;

	readonly files: Map<Path_Id, Source_File> = new Map();

	#watch_dir: typeof watch_dir;
	#watch_dir_options: Partial<Watch_Dir_Options>;

	constructor(options: Options = EMPTY_OBJECT) {
		this.#watch_dir = options.watch_dir ?? watch_dir;
		this.#watch_dir_options = options.watch_dir_options ?? EMPTY_OBJECT;
		this.root_dir = resolve(options.watch_dir_options?.dir ?? paths.source);
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
			ctime: null,
			mtime: null,
			dependents: new Map(),
			dependencies: new Map(),
		};
		this.files.set(id, file);
		return file;
	};

	#update(id: Path_Id): Source_File | null {
		const file = this.get_or_create(id);

		const stats = existsSync(id) ? statSync(id) : null;
		// const mtime_prev = file.mtime;
		// const mtime_changed = mtime_prev !== (stats?.mtimeMs ?? null);
		file.ctime = stats?.ctimeMs ?? null;
		file.mtime = stats?.mtimeMs ?? null;

		const new_contents = stats ? readFileSync(id, 'utf8') : null;

		if (file.contents === new_contents) {
			return null;
		}

		file.contents = new_contents;

		const dir = dirname(file.id);

		const dependencies_before = new Set(file.dependencies.keys());
		const dependencies_removed = new Set(dependencies_before);

		const imported = file.contents ? parse_imports(file.id, file.contents) : [];
		for (const specifier of imported) {
			// TODO logic is duplicated from loader
			const path = map_sveltekit_aliases(specifier, aliases);

			// TODO BLOCK should we have a filter for a subset of the node_modules so it doesn't load everything?
			// TODO BLOCK include `external: true`
			// TODO BLOCK test this
			// The specifier `path` has now been mapped to its final form, so we can inspect it.
			const resolved =
				path[0] === '.' || path[0] === '/'
					? resolve_specifier(path, dir)
					: resolve_node_specifier(path, dir);
			const {path_id} = resolved;
			dependencies_removed.delete(path_id);
			if (!dependencies_before.has(path_id)) {
				const d = this.get_or_create(path_id);
				file.dependencies.set(d.id, d);
				d.dependents.set(file.id, file);
			}
		}

		// update any removed dependencies
		for (const dependency_removed of dependencies_removed) {
			const deleted1 = file.dependencies.delete(dependency_removed);
			if (!deleted1) throw Error('expected to delete1 ' + file.id); // TODO @many delete if correct
			const dependency_removed_file = this.get_or_create(dependency_removed);
			const deleted2 = dependency_removed_file.dependents.delete(file.id);
			if (!deleted2) throw Error('expected to delete2 ' + file.id); // TODO @many delete if correct
		}

		return file;
	}

	#remove(id: Path_Id): Source_File | null {
		const file = this.get_by_id(id);
		if (!file) return null; // this is safe because the object would exist if any other file referenced it as a dependency or dependent

		file.contents = null; // clear contents in case it gets re-added later, we want the change to be detected

		let found = false;
		for (const d of this.files.values()) {
			if (d.dependencies.has(file.id)) {
				found = true;
				break;
			}
		}
		if (!found) this.files.delete(id);

		return file;
	}

	#notify_listener(listener: On_Filer_Change): void {
		if (!this.#ready) return;
		for (const source_file of this.files.values()) {
			listener({type: 'add', path: source_file.id, is_directory: false}, source_file);
		}
	}

	#notify_change(change: Watcher_Change, source_file: Source_File): void {
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
			...this.#watch_dir_options,
			dir: this.root_dir,
			on_change: this.#on_change,
		});
		await this.#watching.init();
		this.#ready = true;
		this.#notify_listener(listener);
	}

	async #remove_listener(listener: On_Filer_Change): Promise<void> {
		this.#listeners.delete(listener);
		if (this.#listeners.size === 0) {
			await this.close(); // TODO is this right? should `watch` be async?
		}
	}

	#on_change: Watcher_Change_Callback = (change) => {
		if (change.is_directory) return;
		let source_file: Source_File | null;
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
		await this.#add_listener(listener);
		return () => this.#remove_listener(listener);
	}

	async close(): Promise<void> {
		this.#ready = false;
		this.#listeners.clear();
		if (this.#watching) {
			await this.#watching.close();
			this.#watching = undefined;
		}
	}
}
