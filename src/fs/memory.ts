import {compareSimpleMapEntries, sortMap} from '@feltcoop/util/map.js';
import type {Assignable} from '@feltcoop/util/types.js';
import {toPathParts} from '@feltcoop/util/pathParsing.js';
import {ensureEnd, stripStart} from '@feltcoop/util/string.js';

import {
	toFsId,
	FsStats,
	type Filesystem,
	type FsReadFile,
	type FsCopyOptions,
	type FsId,
	type FsMoveOptions,
	type FsNode,
} from './filesystem.js';
import type {PathStats} from './pathData.js';
import type {PathFilter} from './filter.js';
import type {Encoding} from './encoding.js';

// TODO should this module have a more specific name? or a more specific directory, with all other implementations?

// TODO extend EventEmitter and emit lots of events

// TODO improve perf in data structures and algorithms for large workloads

const ROOT = '/';

export class MemoryFs implements Filesystem {
	_root = toFsId('.');

	// TODO for now we're prefixing all non-Fs API with an underscore for clarity, maybe compose better?
	_files: Map<FsId, FsNode> = new Map();
	_exists(path: string): boolean {
		return this._files.has(toFsId(path));
	}
	_find(id: FsId): FsNode | undefined {
		return this._files.get(id);
	}
	// finds nodes within `id`, not including `id`; includes all descendents
	_filter(id: FsId): FsNode[] {
		const nodes: FsNode[] = [];
		const node = this._find(id);
		if (!node || !node.isDirectory) return []; // TODO or throw?
		const prefix = id === ROOT ? ROOT : `${id}/`;
		// TODO instead of searching the whole space, could have a better data structure
		// TODO to search just children quickly, we need a better data structure
		// how should this be tracked? sets/maps on each? (see the dependents/dependencies of `BaseFile`s)
		for (const nodeId of this._files.keys()) {
			if (!nodeId.startsWith(prefix) || nodeId === ROOT) continue;
			nodes.push(this._files.get(nodeId)!);
		}
		return nodes;
	}
	_update(id: FsId, node: FsNode): void {
		// TODO should this merge? or always expect that upstream? or maybe `_merge`
		// const existing = this._find(id);
		this._files.set(id, node);
	}
	_add(node: FsNode): void {
		const pathParts = toPathParts(node.id);
		pathParts.unshift(ROOT); // TODO hacky
		// skip the last one, that's what's created above
		for (let i = 0; i < pathParts.length - 1; i++) {
			const pathPart = pathParts[i];
			const isDirectory = true;
			const stats = new FsStats(isDirectory);
			this._update(pathPart, {
				id: pathPart,
				isDirectory,
				encoding: null,
				content: null,
				// contentBuffer: null,
				stats,
				// pathData: toPathData(pathPart, stats),
			});
		}
		this._update(node.id, node);
	}
	_remove(id: FsId): void {
		this._files.delete(id);
	}
	// delete everything, a very safe and cool `rm -rf /`
	_reset(): void {
		this._files.clear();
	}

	stat = async (path: string): Promise<PathStats> => {
		const id = toFsId(path);
		const file = this._find(id);
		if (!file) {
			throw Error(`ENOENT: no such file or directory, stat '${id}'`);
		}
		return file.stats;
	};
	exists = async (path: string): Promise<boolean> => {
		const id = toFsId(path);
		return this._files.has(id);
	};
	// TODO the `any` fixes a type error, not sure how to fix properly
	readFile: FsReadFile = async (path: string, encoding?: Encoding): Promise<any> => {
		const id = toFsId(path);
		const file = this._find(id);
		if (!file) {
			throw Error(`ENOENT: no such file or directory, open '${id}'`);
		}
		if (file.encoding !== encoding) {
			console.error('unexpected encoding mismatch', encoding, file);
		}
		return file.content || '';
	};
	writeFile = async (path: string, data: any, encoding: Encoding = 'utf8'): Promise<void> => {
		const id = toFsId(path);

		// does the file already exist? update if so
		const file = this._find(id);
		if (file) {
			(file as Assignable<FsNode, 'content'>).content = data;
			return;
		}

		// doesn't exist, so create it
		const stats = new FsStats(false);
		this._add({
			id,
			isDirectory: false,
			encoding,
			content: data,
			// contentBuffer: data, // TODO lazily load this?
			stats,
			// pathData: toPathData(id, stats),
		});
	};
	remove = async (path: string): Promise<void> => {
		const id = toFsId(path);
		const file = this._find(id);
		if (!file) return; // silent no-op like `fs-extra`
		if (file.isDirectory) {
			// this search finds all descendent nodes, no need to recurse
			for (const node of this._filter(id)) {
				this._remove(node.id);
			}
		}
		this._remove(id); // remove children above first
	};
	// doing the simple thing: copy+remove (much simpler especially when caches get complex)
	move = async (srcPath: string, destPath: string, options?: FsMoveOptions): Promise<void> => {
		const srcId = toFsId(srcPath);
		await this.stat(srcId); // throws with the same error as `fs-extra` if it doesn't exist
		await this.copy(srcId, destPath, {overwrite: options?.overwrite});
		await this.remove(srcId);
	};
	copy = async (srcPath: string, destPath: string, options?: FsCopyOptions): Promise<void> => {
		const overwrite = options?.overwrite;
		const filter = options?.filter;
		const srcId = toFsId(srcPath);
		// first grab the nodes and delete the src
		const srcNodes = this._filter(srcId);
		srcNodes.push(this._find(srcId)!); // calling `stat` above so the assertion is safe
		srcNodes.sort((a, b) => a.id.localeCompare(b.id)); // TODO do this elsewhere? maybe in `_filter`?
		const destId = toFsId(destPath);
		// create a new node at the new location
		await Promise.all(
			srcNodes.map(async (srcNode) => {
				const nodeDestId = `${destId === ROOT ? '' : destId}${stripStart(srcNode.id, srcId)}`;
				if (filter && !(await filter(srcNode.id, nodeDestId))) return;
				const exists = this._files.has(nodeDestId);
				let output = false;
				if (exists) {
					if (overwrite) {
						await this.remove(nodeDestId);
						output = true;
					} else {
						throw Error(`dest already exists: ${nodeDestId}`);
					}
				} else {
					output = true;
				}
				if (output) {
					await this.writeFile(nodeDestId, srcNode.content, srcNode.encoding);
				}
			}),
		);
	};
	ensureDir = async (path: string): Promise<void> => {
		const id = toFsId(path);
		if (this._find(path)) return;
		const isDirectory = true;
		const stats = new FsStats(isDirectory);
		this._add({
			id,
			isDirectory,
			encoding: null,
			content: null,
			// contentBuffer: null,
			stats,
			// pathData: toPathData(id, stats),
		});
	};
	readDir = async (path: string): Promise<string[]> => {
		const id = toFsId(path);
		const idSlash = ensureEnd(id, ROOT);
		const nodes = this._filter(id);
		return nodes.map((node) => stripStart(node.id, idSlash));
	};
	emptyDir = async (path: string): Promise<void> => {
		const id = toFsId(path);
		await Promise.all(this._filter(id).map((node) => this.remove(node.id)));
	};
	findFiles = async (
		dir: string,
		filter?: PathFilter,
		sort: typeof compareSimpleMapEntries | null = compareSimpleMapEntries,
	): Promise<Map<string, PathStats>> => {
		// TODO wait so in the dir .. we can now find this dir and all of its subdirs
		// cache the subdirs somehow (backlink to parent node? do we have stable references? we do ya?)

		const found = new Map();
		const baseDir = toFsId(dir);
		const baseDirSlash = ensureEnd(baseDir, ROOT);
		for (const file of this._files.values()) {
			if (file.id === baseDir || !file.id.startsWith(baseDir)) continue;
			const path = stripStart(file.id, baseDirSlash);
			if (!filter || filter({path, stats: file.stats})) {
				found.set(path, file.stats);
			}
		}
		return sort ? sortMap(found, sort) : found;
	};
}

export const fs = new MemoryFs();
