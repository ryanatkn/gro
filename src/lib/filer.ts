import {EMPTY_OBJECT} from '@ryanatkn/belt/object.js';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import type {Omit_Strict} from '@ryanatkn/belt/types.js';
import {wait} from '@ryanatkn/belt/async.js';
import {isBuiltin} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {Unreachable_Error} from '@ryanatkn/belt/error.js';
import type {Logger} from '@ryanatkn/belt/log.js';
import type {Package_Json} from '@ryanatkn/belt/package_json.js';

import type {File_Filter, Path_Id} from './path.ts';
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

const aliases = Object.entries(default_svelte_config.alias);

export interface Source_File {
	id: Path_Id;
	// TODO figure out the best API that makes this lazy
	/**
	 * `null` contents means it doesn't exist.
	 * We create the file in memory to track its dependents regardless of its existence on disk.
	 */
	contents: string | null;
	/**
	 * Is the source file outside of the `root_dir` or excluded by `watch_dir_options.filter`?
	 */
	external: boolean;
	ctime: number | null;
	mtime: number | null;
	dependents: Map<Path_Id, Source_File>;
	dependencies: Map<Path_Id, Source_File>;
}

export type Cleanup_Watch = () => Promise<void>;

export type On_Filer_Change = (change: Watcher_Change, source_file: Source_File) => void;

export interface Filer_Options {
	watch_dir?: typeof watch_dir;
	watch_dir_options?: Partial<Omit_Strict<Watch_Dir_Options, 'on_change'>>;
	package_json_cache?: Record<string, Package_Json>;
	log?: Logger;
}

export class Filer {
	readonly root_dir: Path_Id;

	readonly files: Map<Path_Id, Source_File> = new Map();

	#watch_dir: typeof watch_dir;
	#watch_dir_options: Partial<Watch_Dir_Options>;

	#log?: Logger;

	constructor(options: Filer_Options = EMPTY_OBJECT) {
		this.#watch_dir = options.watch_dir ?? watch_dir;
		this.#watch_dir_options = options.watch_dir_options ?? EMPTY_OBJECT;
		this.root_dir = resolve(options.watch_dir_options?.dir ?? paths.source);
		this.#log = options.log;
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

	#update(id: Path_Id): Source_File | null {
		const file = this.get_or_create(id);

		const stats = existsSync(id) ? statSync(id) : null;
		file.ctime = stats?.ctimeMs ?? null;
		file.mtime = stats?.mtimeMs ?? null;

		const new_contents = stats ? readFileSync(id, 'utf8') : null; // TODO need to lazily load contents, probably turn `Source_File` into a class

		if (file.contents === new_contents) {
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

	#sync_listener_with_files(listener: On_Filer_Change): void {
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
			this.#sync_listener_with_files(listener);
			return;
		}
		this.#watching = this.#watch_dir({
			...this.#watch_dir_options,
			dir: this.root_dir,
			on_change: this.#on_change,
		});
		await this.#watching.init();
		this.#ready = true;
		this.#sync_listener_with_files(listener);
	}

	async #remove_listener(listener: On_Filer_Change): Promise<void> {
		this.#listeners.delete(listener);
		if (this.#listeners.size === 0) {
			await this.close(); // TODO is this right? should `watch` be async?
		}
	}

	#on_change: Watcher_Change_Callback = (change) => {
		if (change.is_directory) return; // TODO manage directories?
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

	#is_external(id: string): boolean {
		const {filter} = this.#watch_dir_options;
		return !id.startsWith(this.root_dir + '/') || (!!filter && !filter(id, false));
	}
}

// TODO maybe `Source_File` class?
export const filter_dependents = (
	source_file: Source_File,
	get_by_id: (id: Path_Id) => Source_File | undefined,
	filter?: File_Filter,
	results: Set<string> = new Set(),
	searched: Set<string> = new Set(),
	log?: Logger,
): Set<string> => {
	const {dependents} = source_file;
	for (const dependent_id of dependents.keys()) {
		if (searched.has(dependent_id)) continue;
		searched.add(dependent_id);
		if (!filter || filter(dependent_id)) {
			results.add(dependent_id);
		}
		const dependent_source_file = get_by_id(dependent_id);
		if (!dependent_source_file) {
			log?.warn(
				`[filer.filter_dependents] dependent source file ${dependent_id} not found for ${source_file.id}`,
			);
			continue;
		}
		filter_dependents(dependent_source_file, get_by_id, filter, results, searched);
	}
	return results;
};
