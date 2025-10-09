import {EMPTY_OBJECT} from '@ryanatkn/belt/object.js';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import type {Omit_Strict} from '@ryanatkn/belt/types.js';
import {isBuiltin} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {Unreachable_Error} from '@ryanatkn/belt/error.js';
import type {Logger} from '@ryanatkn/belt/log.js';
import type {Package_Json} from '@ryanatkn/belt/package_json.js';
import type {File_Filter, Path_Id} from '@ryanatkn/belt/path.js';

import {
	watch_dir,
	type Watch_Node_Fs,
	type Watcher_Change,
	type Watch_Dir_Options,
	type Watcher_Change_Callback,
} from './watch_dir.ts';
import {paths} from './paths.ts';
import {parse_imports} from './parse_imports.ts';
import {resolve_specifier} from './resolve_specifier.ts';
import {default_svelte_config} from './svelte_config.ts';
import {map_sveltekit_aliases} from './sveltekit_helpers.ts';
import {SVELTEKIT_GLOBAL_SPECIFIER} from './constants.ts';
import type {Disknode} from './disknode.ts';

const aliases = Object.entries(default_svelte_config.alias);

export type On_Filer_Change = (change: Watcher_Change, disknode: Disknode) => void;

export interface Filer_Options {
	watch_dir?: typeof watch_dir;
	watch_dir_options?: Partial<Omit_Strict<Watch_Dir_Options, 'on_change'>>;
	package_json_cache?: Record<string, Package_Json>;
	log?: Logger;
}

export class Filer {
	readonly root_dir: Path_Id;

	// TODO rename everything to `disknode`
	readonly files: Map<Path_Id, Disknode> = new Map();

	#watch_dir: typeof watch_dir;
	#watch_dir_options: Partial<Watch_Dir_Options>;

	#log?: Logger;

	#listeners: Set<On_Filer_Change> = new Set();
	#watching: Watch_Node_Fs | undefined;
	#initing: Promise<void> | undefined;
	#closing: Promise<void> | undefined;

	constructor(options: Filer_Options = EMPTY_OBJECT) {
		this.#watch_dir = options.watch_dir ?? watch_dir;
		this.#watch_dir_options = options.watch_dir_options ?? EMPTY_OBJECT;
		this.root_dir = resolve(options.watch_dir_options?.dir ?? paths.source);
		// TODO for package.json maybe another array of files/dirs to watch to invalidate everything?
		// or instead of that, think of taking an array of config objects that can specify invalidation rules,
		// so package.json would be configured differently than ./src, and we could add a default with
		// package.json/gro.config.ts/tsconfig.json/svelte.config.js/vite.config.ts to invalidate everything
		this.#log = options.log;
	}
	get inited(): boolean {
		return this.#watching !== undefined;
	}

	get_by_id = (id: Path_Id): Disknode | undefined => {
		return this.files.get(id);
	};

	get_or_create = (id: Path_Id): Disknode => {
		const existing = this.get_by_id(id);
		if (existing) return existing;
		const file: Disknode = {
			id,
			contents: null,
			external: this.#is_external(id), // TODO maybe filter externals by default? the user needs to configure the filer then
			ctime: null,
			mtime: null,
			dependents: new Map(),
			dependencies: new Map(),
		};
		this.files.set(id, file);
		// TODO this may need to be batched/deferred
		if (file.external) {
			this.#on_change({type: 'add', path: file.id, is_directory: false});
		}
		return file;
	};

	filter(predicate: (disknode: Disknode) => boolean): Array<Disknode> | null {
		let found: Array<Disknode> | null = null;
		for (const disknode of this.files.values()) {
			if (predicate(disknode)) {
				(found ??= []).push(disknode);
			}
		}
		return found;
	}

	/**
	 * Initialize the filer to populate files without watching.
	 * Safe to call multiple times - subsequent calls are no-ops.
	 * Used by gen files to access the file graph.
	 */
	async init(): Promise<void> {
		// if already initing, return the existing promise
		if (this.#initing) return this.#initing;

		// if already initialized, just ensure ready
		if (this.#watching) {
			return this.#watching.init();
		}

		// start new initialization
		this.#initing = this.#init();
		try {
			await this.#initing;
		} catch (err) {
			// use shared cleanup logic
			this.#cleanup();
			throw err;
		} finally {
			this.#initing = undefined;
		}
	}

	async #init(): Promise<void> {
		const watcher = this.#watch_dir({
			...this.#watch_dir_options,
			dir: this.root_dir,
			on_change: this.#on_change,
		});

		try {
			await watcher.init();

			// check if close() was called during init
			if (this.#closing) {
				await watcher.close();
				return;
			}

			// only set after successful init and not closing
			this.#watching = watcher;
		} catch (err) {
			// clean up watcher on error, but don't let close error mask init error
			try {
				await watcher.close();
			} catch {
				// ignore close errors - init error is more important
			}
			throw err;
		}
	}

	async watch(listener: On_Filer_Change): Promise<() => void> {
		await this.#add_listener(listener);
		return () => {
			this.#remove_listener(listener);
		};
	}

	/**
	 * Internal cleanup of all state - can be called safely from anywhere
	 */
	#cleanup(): void {
		this.#listeners.clear();
		this.files.clear();
		this.#watching = undefined;
		// #initing is handled in finally block of init()
	}

	close(): Promise<void> {
		// if already closing, return existing promise
		if (this.#closing) return this.#closing;

		// if already closed and not initing, nothing to do
		if (!this.#watching && !this.#initing) return Promise.resolve();

		// start new close operation
		const closing = this.#close();
		this.#closing = closing;
		// Clean up after completion, but don't change the returned promise
		// Use void to ensure we don't accidentally return the .then() promise
		void closing.then(
			() => {
				this.#closing = undefined;
			},
			() => {
				this.#closing = undefined;
			},
		);
		return this.#closing;
	}

	async #close(): Promise<void> {
		// wait for any pending initialization to complete
		if (this.#initing) {
			try {
				await this.#initing;
			} catch {
				// ignore errors during close
			}
		}

		// close watcher if it exists
		if (this.#watching) {
			await this.#watching.close();
		}

		// clean up all state
		this.#cleanup();
	}

	#update(id: Path_Id): Disknode | null {
		const file = this.get_or_create(id);

		const stats = existsSync(id) ? statSync(id) : null;
		const old_mtime = file.mtime;
		file.ctime = stats?.ctimeMs ?? null;
		file.mtime = stats?.mtimeMs ?? null;

		const new_contents = stats ? readFileSync(id, 'utf8') : null; // TODO need to lazily load contents, probably turn `Disknode` into a class

		if (file.mtime === old_mtime && file.contents === new_contents) {
			return null;
		}

		file.contents = new_contents;

		const dir = dirname(file.id);

		const dependencies_before = new Set(file.dependencies.keys());
		const dependencies_removed = new Set(dependencies_before);

		const imported = file.contents ? parse_imports(file.id, file.contents) : [];
		for (const specifier of imported) {
			if (SVELTEKIT_GLOBAL_SPECIFIER.test(specifier)) continue;
			const path = map_sveltekit_aliases(specifier, aliases);

			let path_id;
			// TODO can we replace `resolve_specifier` with `import.meta.resolve` completely now outside of esbuild plugins?
			if (path[0] === '.' || path[0] === '/') {
				const resolved = resolve_specifier(path, dir);
				path_id = resolved.path_id;
			} else {
				if (isBuiltin(path)) continue;
				const file_url = pathToFileURL(file.id);
				try {
					path_id = fileURLToPath(import.meta.resolve(path, file_url.href));
				} catch (error) {
					// if resolving fails for any reason, just log and ignore it
					this.#log?.error('[filer] failed to resolve path', path, file_url.href, error);
					continue;
				}
			}
			dependencies_removed.delete(path_id);
			if (!dependencies_before.has(path_id)) {
				const d = this.get_or_create(path_id);
				file.dependencies.set(d.id, d);
				d.dependents.set(file.id, file);
			}
		}

		// update any removed dependencies
		for (const dependency_removed of dependencies_removed) {
			file.dependencies.delete(dependency_removed);
			const dependency_removed_file = this.get_or_create(dependency_removed);
			dependency_removed_file.dependents.delete(file.id);
		}

		return file;
	}

	#remove(id: Path_Id): Disknode | null {
		const file = this.get_by_id(id);
		if (!file) return null; // this is safe because the object would exist if any other file referenced it as a dependency or dependent

		file.contents = null; // clear contents in case it gets re-added later, we want the change to be detected

		file.dependencies.clear();

		// keep the file in memory if other files still depend on it
		if (file.dependents.size === 0) {
			this.files.delete(id);
		}

		return file;
	}

	#sync_listener_with_files(listener: On_Filer_Change): void {
		for (const disknode of this.files.values()) {
			try {
				listener({type: 'add', path: disknode.id, is_directory: false}, disknode);
			} catch (err) {
				this.#log?.error('[filer] Listener error during sync:', err);
			}
		}
	}

	#notify_change(change: Watcher_Change, disknode: Disknode): void {
		for (const listener of this.#listeners) {
			try {
				listener(change, disknode);
			} catch (err) {
				this.#log?.error('[filer] Listener error during change notification:', err);
			}
		}
	}

	async #add_listener(listener: On_Filer_Change): Promise<void> {
		this.#listeners.add(listener);

		// ensure initialized
		await this.init();

		// notify of existing files
		this.#sync_listener_with_files(listener);
	}

	#remove_listener(listener: On_Filer_Change): void {
		this.#listeners.delete(listener);
		// keep watching active even with no listeners, only close() tears down
	}

	#on_change: Watcher_Change_Callback = (change) => {
		if (this.#closing) return; // ignore changes during close
		if (change.is_directory) return; // TODO manage directories?
		let disknode: Disknode | null;
		switch (change.type) {
			case 'add':
			case 'update': {
				disknode = this.#update(change.path);
				break;
			}
			case 'delete': {
				disknode = this.#remove(change.path);
				break;
			}
			default:
				throw new Unreachable_Error(change.type);
		}
		if (disknode && this.#listeners.size > 0) {
			this.#notify_change(change, disknode);
		}
	};

	#is_external(id: Path_Id): boolean {
		const {filter} = this.#watch_dir_options;
		return !id.startsWith(this.root_dir + '/') || (!!filter && !filter(id, false));
	}
}

// TODO maybe `Disknode` class?
export const filter_dependents = (
	disknode: Disknode,
	get_by_id: (id: Path_Id) => Disknode | undefined,
	filter?: File_Filter,
	results: Set<Path_Id> = new Set(),
	searched: Set<Path_Id> = new Set(),
	log?: Logger,
): Set<Path_Id> => {
	const {dependents} = disknode;
	for (const dependent_id of dependents.keys()) {
		if (searched.has(dependent_id)) continue;
		searched.add(dependent_id);
		if (!filter || filter(dependent_id)) {
			results.add(dependent_id);
		}
		const dependent_disknode = get_by_id(dependent_id);
		if (!dependent_disknode) {
			log?.warn(
				`[filer.filter_dependents] dependent source file ${dependent_id} not found for ${disknode.id}`,
			);
			continue;
		}
		filter_dependents(dependent_disknode, get_by_id, filter, results, searched);
	}
	return results;
};
