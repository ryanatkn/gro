import {Fs, toFsId, FsStats} from './filesystem.js';
import type {FsCopyOptions, FsId, FsMoveOptions, FsNode} from './filesystem';
import {toPathData} from './pathData.js';
import type {PathStats} from './pathData.js';
import {compareSimpleMapEntries} from '../utils/map.js';
import type {PathFilter} from './pathFilter.js';
import type {Encoding} from './encoding.js';
import type {Assignable} from '../utils/types.js';
import {toPathParts} from '../utils/path.js';

// TODO extend EventEmitter and emit lots of events
// TODO formalize module interface for all filesystem impls
// TODO should this module have a more specific name? or a more specific directory, with all other implementations?

// TODO can we have internal methods that don't normalize `toFsId`? or flags to avoid normalizing? (optional bool? could be a long-lived object)

export class MemoryFs extends Fs {
	// TODO for now we're prefixing all non-Fs API with an underscore for clarity, maybe compose better?
	// TODO other data structures? what access patterns do we want to optimize for?
	_files: Map<FsId, FsNode> = new Map();
	_find(id: FsId): FsNode | undefined {
		return this._files.get(id);
	}
	_update(id: FsId, node: FsNode): void {
		// TODO should this merge? or always expect that upstream? or maybe `_merge`
		this._files.set(id, node);
	}
	_add(node: FsNode): void {
		this._update(node.id, node);
		const pathParts = toPathParts(node.id);
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
	pathExists = async (path: string): Promise<boolean> => {
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
		// TODO
	};
	move = async (src: string, dest: string, options?: FsMoveOptions): Promise<void> => {
		// TODO
	};
	copy = async (src: string, dest: string, options?: FsCopyOptions): Promise<void> => {
		// TODO
	};
	readDir = async (path: string): Promise<string[]> => {
		// TODO
		return [];
	};
	emptyDir = async (path: string): Promise<void> => {
		// TODO
	};
	ensureDir = async (path: string): Promise<void> => {
		if (await this.pathExists(path)) return;
		// TODO normalize path
		const id = toFsId(path);
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
