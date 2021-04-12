import {Fs, toFsId, FsStats} from './filesystem.js';
import type {FsCopyOptions, FsId, FsMoveOptions, FsNode} from './filesystem';
import {toPathData} from './pathData.js';
import type {PathStats} from './pathData.js';
import {compareSimpleMapEntries} from '../utils/map.js';
import type {PathFilter} from './pathFilter.js';
import type {Encoding} from './encoding.js';
import type {Assignable} from '../utils/types.js';
import {toPathParts} from '../utils/path.js';
import {stripStart} from '../utils/string.js';

// TODO resolve paths
// TODO extend EventEmitter and emit lots of events
// TODO formalize module interface for all filesystem impls
// TODO should this module have a more specific name? or a more specific directory, with all other implementations?

// TODO can we have internal methods that don't normalize `toFsId`? or flags to avoid normalizing? (optional bool? could be a long-lived object)

// TODO
// TODO
// TODO bug with filters - need filter all children vs filter shallow children

export class MemoryFs extends Fs {
	_root = toFsId('.');

	// TODO for now we're prefixing all non-Fs API with an underscore for clarity, maybe compose better?
	// TODO other data structures? what access patterns do we want to optimize for?
	_files: Map<FsId, FsNode> = new Map();
	_exists(path: string): boolean {
		return this._files.has(toFsId(path));
	}
	_find(id: FsId): FsNode | undefined {
		return this._files.get(id);
	}
	// finds nodes within `id`, not including `id`
	_filter(id: FsId): FsNode[] {
		const nodes: FsNode[] = [];
		const node = this._find(id);
		if (!node || !node.isDirectory) return []; // TODO or throw?
		const prefix = id === '/' ? '/' : `${id}/`;
		// TODO instead of searching the whole space, could have a better data structure
		// TODO to search just children quickly, we need a better data structure
		// how should this be tracked? sets/maps on each? (see the dependents/dependencies of `BaseBuildableFile`s)
		for (const nodeId of this._files.keys()) {
			if (!nodeId.startsWith(prefix) || id === nodeId) {
				continue; // `id === nodeId` when value is `/` and it goes into an infinite loop
			}
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
		pathParts.unshift('/'); // TODO hacky
		// skip the last one, that's what's created above
		for (let i = 0; i < pathParts.length - 1; i++) {
			const pathPart = pathParts[i];
			const isDirectory = true;
			const stats = new FsStats(isDirectory);
			this._update(pathPart, {
				id: pathPart,
				isDirectory,
				encoding: null,
				contents: null,
				// contentsBuffer: null,
				stats,
				path: toPathData(pathPart, stats),
			});
		}
		this._update(node.id, node);
	}
	_remove(id: FsId): void {
		this._files.delete(id);
	}
	// delete everything, a very safe and cool `rm -rf /`
	_reset() {
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
	readFile: Fs['readFile'] = async (path: string, encoding?: Encoding): Promise<any> => {
		const id = toFsId(path);
		const file = this._find(id);
		if (!file) {
			throw Error(`ENOENT: no such file or directory, open '${id}'`);
		}
		if (file.encoding !== encoding) {
			console.error('unexpected encoding mismatch', encoding, file);
		}
		return file.contents || '';
	};
	readJson = async (path: string): Promise<any> => {
		const contents = await this.readFile(path, 'utf8');
		return JSON.parse(contents);
	};
	outputFile = async (path: string, data: any, encoding: Encoding = 'utf8'): Promise<void> => {
		const id = toFsId(path);

		// does the file already exist? update if so
		const file = this._find(id);
		if (file) {
			(file as Assignable<FsNode, 'contents'>).contents = data;
			return;
		}

		// doesn't exist, so create it
		const stats = new FsStats(false);
		this._add({
			id,
			isDirectory: false,
			encoding,
			contents: data,
			// contentsBuffer: data, // TODO lazily load this?
			stats,
			path: toPathData(id, stats),
		});
	};
	remove = async (path: string): Promise<void> => {
		const id = toFsId(path);
		const file = this._find(id);
		if (!file) return; // silent no-op like `fs-extra`
		if (file.isDirectory) {
			for (const node of this._filter(id)) {
				await this.remove(node.id);
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
		const srcId = toFsId(srcPath);
		// first grab the nodes and delete the src
		const srcNodes = this._filter(srcId);
		srcNodes.push(this._find(srcId)!); // calling `stat` above so the assertion is safe
		srcNodes.sort((a, b) => a.id.localeCompare(b.id)); // TODO do this elsewhere? maybe in `_filter`?
		const destId = toFsId(destPath);
		// create a new node at the new location
		for (const srcNode of srcNodes) {
			const nodeDestId = `${destId}${stripStart(srcNode.id, srcId)}`;
			const exists = this._files.has(nodeDestId);
			let output = false;
			if (exists) {
				if (options?.overwrite) {
					await this.remove(nodeDestId);
					output = true;
				} else {
					throw Error(`dest already exists: ${nodeDestId}`);
				}
			} else {
				output = true;
			}
			if (output) {
				await this.outputFile(nodeDestId, srcNode.contents, srcNode.encoding);
			}
		}
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
			contents: null,
			// contentsBuffer: null,
			stats,
			path: toPathData(id, stats),
		});
	};
	readDir = async (path: string): Promise<string[]> => {
		// TODO use `_filter` - does it return relative? what behavior for missing, or file?
		return [];
	};
	emptyDir = async (path: string): Promise<void> => {
		const id = toFsId(path);
		for (const node of this._filter(id)) {
			await this.remove(node.id);
		}
	};
	findFiles = async (
		dir: string,
		filter?: PathFilter,
		// pass `null` to speed things up at the risk of rare misorderings
		sort: typeof compareSimpleMapEntries | null = compareSimpleMapEntries,
	): Promise<Map<string, PathStats>> => {
		// TODO wait so in the dir .. we can now find this dir and all of its subdirs
		// cache the subdirs somehow (backlink to parent node? do we have stable references? we do ya?)

		const found = new Map();
		const baseDir = toFsId(dir); // TODO resolve relative to filesystem's base (mount at `/` in memory!)
		for (const file of this._files.values()) {
			if (file.id.startsWith(baseDir)) {
				// TODO should each file have its `basePath`?
				// const basePath = stripStart(file.id, baseDir);
				// console.log('basePath', basePath);
				found.set(file.id, file.stats);
			}
		}
		// console.log('found', Array.from(found.entries()));
		return found;
	};
}

export const fs = new MemoryFs();
