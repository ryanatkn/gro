import {compare_simple_map_entries, sort_map} from '@feltcoop/felt/util/map.js';
import type {Assignable} from '@feltcoop/felt/util/types.js';
import {to_path_parts} from '@feltcoop/felt/util/path_parsing.js';
import {ensure_end, strip_start} from '@feltcoop/felt/util/string.js';

import {to_fs_id, Fs_Stats} from './filesystem.js';
import type {Filesystem, Fs_Read_File} from 'src/fs/filesystem.js';
import type {Fs_Copy_Options, Fs_Id, Fs_Move_Options, Fs_Node} from 'src/fs/filesystem';
import type {Path_Stats} from 'src/fs/path_data.js';
import type {Path_Filter} from 'src/fs/filter.js';
import type {Encoding} from 'src/fs/encoding.js';

// TODO should this module have a more specific name? or a more specific directory, with all other implementations?

// TODO extend EventEmitter and emit lots of events

// TODO improve perf in data structures and algorithms for large workloads

const ROOT = '/';

export class Memory_Fs implements Filesystem {
	_root = to_fs_id('.');

	// TODO for now we're prefixing all non-Fs API with an underscore for clarity, maybe compose better?
	_files: Map<Fs_Id, Fs_Node> = new Map();
	_exists(path: string): boolean {
		return this._files.has(to_fs_id(path));
	}
	_find(id: Fs_Id): Fs_Node | undefined {
		return this._files.get(id);
	}
	// finds nodes within `id`, not including `id`; includes all descendents
	_filter(id: Fs_Id): Fs_Node[] {
		const nodes: Fs_Node[] = [];
		const node = this._find(id);
		if (!node || !node.is_directory) return []; // TODO or throw?
		const prefix = id === ROOT ? ROOT : `${id}/`;
		// TODO instead of searching the whole space, could have a better data structure
		// TODO to search just children quickly, we need a better data structure
		// how should this be tracked? sets/maps on each? (see the dependents/dependencies of `Base_Buildable_File`s)
		for (const node_id of this._files.keys()) {
			if (!node_id.startsWith(prefix) || node_id === ROOT) continue;
			nodes.push(this._files.get(node_id)!);
		}
		return nodes;
	}
	_update(id: Fs_Id, node: Fs_Node): void {
		// TODO should this merge? or always expect that upstream? or maybe `_merge`
		// const existing = this._find(id);
		this._files.set(id, node);
	}
	_add(node: Fs_Node): void {
		const path_parts = to_path_parts(node.id);
		path_parts.unshift(ROOT); // TODO hacky
		// skip the last one, that's what's created above
		for (let i = 0; i < path_parts.length - 1; i++) {
			const pathPart = path_parts[i];
			const is_directory = true;
			const stats = new Fs_Stats(is_directory);
			this._update(pathPart, {
				id: pathPart,
				is_directory,
				encoding: null,
				content: null,
				// content_buffer: null,
				stats,
				// path_data: to_path_data(pathPart, stats),
			});
		}
		this._update(node.id, node);
	}
	_remove(id: Fs_Id): void {
		this._files.delete(id);
	}
	// delete everything, a very safe and cool `rm -rf /`
	_reset() {
		this._files.clear();
	}

	stat = async (path: string): Promise<Path_Stats> => {
		const id = to_fs_id(path);
		const file = this._find(id);
		if (!file) {
			throw Error(`ENOENT: no such file or directory, stat '${id}'`);
		}
		return file.stats;
	};
	exists = async (path: string): Promise<boolean> => {
		const id = to_fs_id(path);
		return this._files.has(id);
	};
	// TODO the `any` fixes a type error, not sure how to fix properly
	read_file: Fs_Read_File = async (path: string, encoding?: Encoding): Promise<any> => {
		const id = to_fs_id(path);
		const file = this._find(id);
		if (!file) {
			throw Error(`ENOENT: no such file or directory, open '${id}'`);
		}
		if (file.encoding !== encoding) {
			console.error('unexpected encoding mismatch', encoding, file);
		}
		return file.content || '';
	};
	write_file = async (path: string, data: any, encoding: Encoding = 'utf8'): Promise<void> => {
		const id = to_fs_id(path);

		// does the file already exist? update if so
		const file = this._find(id);
		if (file) {
			(file as Assignable<Fs_Node, 'content'>).content = data;
			return;
		}

		// doesn't exist, so create it
		const stats = new Fs_Stats(false);
		this._add({
			id,
			is_directory: false,
			encoding,
			content: data,
			// content_buffer: data, // TODO lazily load this?
			stats,
			// path_data: to_path_data(id, stats),
		});
	};
	remove = async (path: string): Promise<void> => {
		const id = to_fs_id(path);
		const file = this._find(id);
		if (!file) return; // silent no-op like `fs-extra`
		if (file.is_directory) {
			// this search finds all descendent nodes, no need to recurse
			for (const node of this._filter(id)) {
				this._remove(node.id);
			}
		}
		this._remove(id); // remove children above first
	};
	// doing the simple thing: copy+remove (much simpler especially when caches get complex)
	move = async (src_path: string, dest_path: string, options?: Fs_Move_Options): Promise<void> => {
		const src_id = to_fs_id(src_path);
		await this.stat(src_id); // throws with the same error as `fs-extra` if it doesn't exist
		await this.copy(src_id, dest_path, {overwrite: options?.overwrite});
		await this.remove(src_id);
	};
	copy = async (src_path: string, dest_path: string, options?: Fs_Copy_Options): Promise<void> => {
		const overwrite = options?.overwrite;
		const filter = options?.filter;
		const src_id = to_fs_id(src_path);
		// first grab the nodes and delete the src
		const src_nodes = this._filter(src_id);
		src_nodes.push(this._find(src_id)!); // calling `stat` above so the assertion is safe
		src_nodes.sort((a, b) => a.id.localeCompare(b.id)); // TODO do this elsewhere? maybe in `_filter`?
		const destId = to_fs_id(dest_path);
		// create a new node at the new location
		for (const src_node of src_nodes) {
			const node_dest_id = `${destId === ROOT ? '' : destId}${strip_start(src_node.id, src_id)}`;
			if (filter && !(await filter(src_node.id, node_dest_id))) continue;
			const exists = this._files.has(node_dest_id);
			let output = false;
			if (exists) {
				if (overwrite) {
					await this.remove(node_dest_id);
					output = true;
				} else {
					throw Error(`dest already exists: ${node_dest_id}`);
				}
			} else {
				output = true;
			}
			if (output) {
				await this.write_file(node_dest_id, src_node.content, src_node.encoding);
			}
		}
	};
	ensure_dir = async (path: string): Promise<void> => {
		const id = to_fs_id(path);
		if (this._find(path)) return;
		const is_directory = true;
		const stats = new Fs_Stats(is_directory);
		this._add({
			id,
			is_directory,
			encoding: null,
			content: null,
			// content_buffer: null,
			stats,
			// path_data: to_path_data(id, stats),
		});
	};
	read_dir = async (path: string): Promise<string[]> => {
		// TODO use `_filter` - does it return relative? what behavior for missing, or file?
		const id = to_fs_id(path);
		const id_slash = ensure_end(id, ROOT);
		const nodes = this._filter(id);
		return nodes.map((node) => strip_start(node.id, id_slash));
	};
	empty_dir = async (path: string): Promise<void> => {
		const id = to_fs_id(path);
		for (const node of this._filter(id)) {
			await this.remove(node.id);
		}
	};
	find_files = async (
		dir: string,
		filter?: Path_Filter,
		sort: typeof compare_simple_map_entries | null = compare_simple_map_entries,
	): Promise<Map<string, Path_Stats>> => {
		// TODO wait so in the dir .. we can now find this dir and all of its subdirs
		// cache the subdirs somehow (backlink to parent node? do we have stable references? we do ya?)

		const found = new Map();
		const base_dir = to_fs_id(dir);
		const base_dir_slash = ensure_end(base_dir, ROOT);
		for (const file of this._files.values()) {
			if (file.id === base_dir || !file.id.startsWith(base_dir)) continue;
			const path = strip_start(file.id, base_dir_slash);
			if (!filter || filter({path, stats: file.stats})) {
				found.set(path, file.stats);
			}
		}
		return sort ? sort_map(found, sort) : found;
	};
}

export const fs = new Memory_Fs();
