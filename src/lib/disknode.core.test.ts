// @slop Claude Opus 4.1

import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest';
import {readFileSync, lstatSync, realpathSync, type Stats} from 'node:fs';

import {Disknode} from './disknode.ts';
import type {Filer} from './filer.ts';
import type {Path_Id} from './path.ts';
import {DISKNODE_MAX_CACHED_SIZE} from './disknode_helpers.ts';

// Mock filesystem modules
vi.mock('node:fs', () => ({
	readFileSync: vi.fn(),
	lstatSync: vi.fn(),
	realpathSync: vi.fn(),
	existsSync: vi.fn(),
}));

// Test constants
const TEST_PATH_TS: Path_Id = '/test/path/a.ts';
const TEST_PATH_JS: Path_Id = '/test/path/b.js';
const TEST_PATH_SVELTE: Path_Id = '/test/path/c.svelte';
const TEST_PATH_SVELTE_TS: Path_Id = '/test/path/d.svelte.ts';
const TEST_PATH_SVELTE_JS: Path_Id = '/test/path/e.svelte.js';
const TEST_PATH_MTS: Path_Id = '/test/path/f.mts';
const TEST_PATH_CJS: Path_Id = '/test/path/g.cjs';
const TEST_PATH_JSON: Path_Id = '/test/path/data.json';
const TEST_PATH_TXT: Path_Id = '/test/path/readme.txt';
const TEST_DIR_PATH: Path_Id = '/test/path';
const TEST_SYMLINK_PATH: Path_Id = '/test/symlink';
const TEST_LARGE_FILE_PATH: Path_Id = '/test/large.txt';

const TEST_CONTENT_TS = 'const a = 1;\nexport {a};';
const TEST_CONTENT_JS = 'import {a} from "./a.js";\nconsole.log(a);';
const TEST_CONTENT_SVELTE = '<script>\nimport {a} from "./a.js";\n</script>\n<div>{a}</div>';
const TEST_CONTENT_SVELTE_TS =
	'import {writable} from "svelte/store";\nexport const count = writable(0);';
const TEST_CONTENT_SVELTE_JS =
	'import {writable} from "svelte/store";\nexport const items = writable([]);';
const TEST_CONTENT_JSON = '{"data": "test"}';
const TEST_CONTENT_TXT = 'This is a text file.';
const TEST_LARGE_CONTENT = 'x'.repeat(15 * 1024 * 1024); // 15MB

// Mock stats factory
const create_mock_stats = (options: Partial<Stats> = {}): Stats =>
	({
		isFile: () => true,
		isDirectory: () => false,
		isSymbolicLink: () => false,
		isBlockDevice: () => false,
		isCharacterDevice: () => false,
		isFIFO: () => false,
		isSocket: () => false,
		dev: 1,
		ino: 1,
		mode: 33188,
		nlink: 1,
		uid: 1000,
		gid: 1000,
		rdev: 0,
		size: 100,
		blksize: 4096,
		blocks: 8,
		atimeMs: Date.now(),
		mtimeMs: Date.now(),
		ctimeMs: Date.now(),
		birthtimeMs: Date.now(),
		atime: new Date(),
		mtime: new Date(),
		ctime: new Date(),
		birthtime: new Date(),
		...options,
	}) as Stats;

// Mock filer
const create_mock_filer = (): Filer =>
	({
		disknodes: new Map(),
		roots: new Set(),
		get_disknode: vi.fn((id: Path_Id) => new Disknode(id, create_mock_filer())),
		map_alias: vi.fn((spec: string) => spec),
		resolve_specifier: vi.fn(() => ({path_id: '/resolved/path.js'})),
		resolve_external_specifier: vi.fn().mockReturnValue('file:///resolved/external.js'),
		parse_imports: vi.fn().mockReturnValue([]),
		observe: vi.fn(),
		find_disknodes: vi.fn(),
		get_dependents: vi.fn(),
		get_dependencies: vi.fn(),
		filter_dependents: vi.fn(),
		get_by_id: vi.fn(),
		rescan_subtree: vi.fn(),
		load_initial_stats: vi.fn(),
		close: vi.fn(),
		reset_watcher: vi.fn(),
	}) as unknown as Filer;

describe('Disknode', () => {
	let filer: Filer;

	beforeEach(() => {
		filer = create_mock_filer();
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('basic functionality', () => {
		test('creates node with correct id and filer', () => {
			const disknode = new Disknode(TEST_PATH_TS, filer);
			expect(disknode.id).toBe(TEST_PATH_TS);
			expect(disknode.api).toBe(filer);
		});

		test('initializes with default properties', () => {
			const disknode = new Disknode(TEST_PATH_TS, filer);
			expect(disknode.kind).toBe('file');
			expect(disknode.is_external).toBe(false);
			expect(disknode.exists).toBe(true);
			expect(disknode.parent).toBe(null);
			expect(disknode.dependents.size).toBe(0);
			expect(disknode.dependencies.size).toBe(0);
			expect(disknode.children.size).toBe(0);
		});

		test('detects TypeScript file extensions', () => {
			const ts_disknode = new Disknode(TEST_PATH_TS, filer);
			expect(ts_disknode.extension).toBe('.ts');
			expect(ts_disknode.is_typescript).toBe(true);
			expect(ts_disknode.is_js).toBe(false);
			expect(ts_disknode.is_svelte).toBe(false);
			expect(ts_disknode.is_importable).toBe(true);

			const mts_disknode = new Disknode(TEST_PATH_MTS, filer);
			expect(mts_disknode.extension).toBe('.mts');
			expect(mts_disknode.is_typescript).toBe(true);
			expect(mts_disknode.is_js).toBe(false);
			expect(mts_disknode.is_importable).toBe(true);
		});

		test('detects JavaScript file extensions', () => {
			const js_disknode = new Disknode(TEST_PATH_JS, filer);
			expect(js_disknode.extension).toBe('.js');
			expect(js_disknode.is_typescript).toBe(false);
			expect(js_disknode.is_js).toBe(true);
			expect(js_disknode.is_svelte).toBe(false);
			expect(js_disknode.is_importable).toBe(true);

			const cjs_disknode = new Disknode(TEST_PATH_CJS, filer);
			expect(cjs_disknode.extension).toBe('.cjs');
			expect(cjs_disknode.is_typescript).toBe(false);
			expect(cjs_disknode.is_js).toBe(true);
			expect(cjs_disknode.is_importable).toBe(true);
		});

		test('detects Svelte files', () => {
			const svelte_disknode = new Disknode(TEST_PATH_SVELTE, filer);
			expect(svelte_disknode.extension).toBe('.svelte');
			expect(svelte_disknode.is_typescript).toBe(false);
			expect(svelte_disknode.is_js).toBe(false);
			expect(svelte_disknode.is_svelte).toBe(true);
			expect(svelte_disknode.is_svelte_module).toBe(false);
			expect(svelte_disknode.is_importable).toBe(true);
		});

		test('detects Svelte TypeScript modules', () => {
			const svelte_ts_disknode = new Disknode(TEST_PATH_SVELTE_TS, filer);
			expect(svelte_ts_disknode.extension).toBe('.ts');
			expect(svelte_ts_disknode.is_typescript).toBe(true);
			expect(svelte_ts_disknode.is_js).toBe(false);
			expect(svelte_ts_disknode.is_svelte).toBe(false);
			expect(svelte_ts_disknode.is_svelte_module).toBe(true);
			expect(svelte_ts_disknode.is_importable).toBe(true);
		});

		test('detects Svelte JavaScript modules', () => {
			const svelte_js_disknode = new Disknode(TEST_PATH_SVELTE_JS, filer);
			expect(svelte_js_disknode.extension).toBe('.js');
			expect(svelte_js_disknode.is_typescript).toBe(false);
			expect(svelte_js_disknode.is_js).toBe(true);
			expect(svelte_js_disknode.is_svelte).toBe(false);
			expect(svelte_js_disknode.is_svelte_module).toBe(true);
			expect(svelte_js_disknode.is_importable).toBe(true);
		});

		test('identifies non-importable files', () => {
			const json_disknode = new Disknode(TEST_PATH_JSON, filer);
			expect(json_disknode.extension).toBe('.json');
			expect(json_disknode.is_importable).toBe(false);

			const txt_disknode = new Disknode(TEST_PATH_TXT, filer);
			expect(txt_disknode.extension).toBe('.txt');
			expect(txt_disknode.is_importable).toBe(false);
		});
	});

	describe('stats lazy loading and caching', () => {
		test('loads stats lazily on first access', () => {
			const mock_stats = create_mock_stats({size: 123, mtimeMs: 1000});
			vi.mocked(lstatSync).mockReturnValue(mock_stats);

			const disknode = new Disknode(TEST_PATH_TS, filer);
			expect(vi.mocked(lstatSync)).not.toHaveBeenCalled();

			const stats = disknode.stats;
			expect(vi.mocked(lstatSync)).toHaveBeenCalledWith(TEST_PATH_TS);
			expect(stats).toBe(mock_stats);
			expect(disknode.size).toBe(123);
			expect(disknode.mtime).toBe(1000);
		});

		test('caches stats on subsequent accesses', () => {
			const mock_stats = create_mock_stats();
			vi.mocked(lstatSync).mockReturnValue(mock_stats);

			const disknode = new Disknode(TEST_PATH_TS, filer);
			const stats1 = disknode.stats;
			const stats2 = disknode.stats;

			expect(vi.mocked(lstatSync)).toHaveBeenCalledTimes(1);
			expect(stats1).toBe(stats2);
		});

		test('handles non-existent files', () => {
			vi.mocked(lstatSync).mockImplementation(() => {
				throw new Error('ENOENT');
			});

			const node = new Disknode(TEST_PATH_TS, filer);
			const stats = node.stats;

			expect(stats).toBe(null);
			expect(node.exists).toBe(false);
			expect(node.size).toBe(null);
			expect(node.mtime).toBe(null);
		});

		test('updates kind based on stats', () => {
			const dir_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => true,
			});
			vi.mocked(lstatSync).mockReturnValue(dir_stats);

			const node = new Disknode(TEST_DIR_PATH, filer);
			node.stats; // trigger load
			expect(node.kind).toBe('directory');

			const symlink_stats = create_mock_stats({
				isFile: () => false,
				isSymbolicLink: () => true,
			});
			vi.mocked(lstatSync).mockReturnValue(symlink_stats);

			const symlink_disknode = new Disknode(TEST_SYMLINK_PATH, filer);
			symlink_disknode.stats; // trigger load
			expect(symlink_disknode.kind).toBe('symlink');
		});

		test('allows setting stats to avoid syscalls', () => {
			const mock_stats = create_mock_stats({size: 456});
			const node = new Disknode(TEST_PATH_TS, filer);

			node.set_stats(mock_stats);
			expect(vi.mocked(lstatSync)).not.toHaveBeenCalled();
			expect(node.stats).toBe(mock_stats);
			expect(node.size).toBe(456);
		});
	});

	describe('contents lazy loading and caching', () => {
		test('loads TypeScript file contents', () => {
			const mock_stats = create_mock_stats({size: 100});
			vi.mocked(lstatSync).mockReturnValue(mock_stats);
			vi.mocked(readFileSync).mockReturnValue(TEST_CONTENT_TS);

			const node = new Disknode(TEST_PATH_TS, filer);
			expect(vi.mocked(readFileSync)).not.toHaveBeenCalled();

			const contents = node.contents;
			expect(vi.mocked(readFileSync)).toHaveBeenCalledWith(TEST_PATH_TS, 'utf8');
			expect(contents).toBe(TEST_CONTENT_TS);
		});

		test('loads JavaScript file contents', () => {
			const mock_stats = create_mock_stats({size: 100});
			vi.mocked(lstatSync).mockReturnValue(mock_stats);
			vi.mocked(readFileSync).mockReturnValue(TEST_CONTENT_JS);

			const node = new Disknode(TEST_PATH_JS, filer);
			const contents = node.contents;
			expect(vi.mocked(readFileSync)).toHaveBeenCalledWith(TEST_PATH_JS, 'utf8');
			expect(contents).toBe(TEST_CONTENT_JS);
		});

		test('loads Svelte file contents', () => {
			const mock_stats = create_mock_stats({size: 100});
			vi.mocked(lstatSync).mockReturnValue(mock_stats);
			vi.mocked(readFileSync).mockReturnValue(TEST_CONTENT_SVELTE);

			const node = new Disknode(TEST_PATH_SVELTE, filer);
			const contents = node.contents;
			expect(vi.mocked(readFileSync)).toHaveBeenCalledWith(TEST_PATH_SVELTE, 'utf8');
			expect(contents).toBe(TEST_CONTENT_SVELTE);
		});

		test('loads Svelte TypeScript module contents', () => {
			const mock_stats = create_mock_stats({size: 100});
			vi.mocked(lstatSync).mockReturnValue(mock_stats);
			vi.mocked(readFileSync).mockReturnValue(TEST_CONTENT_SVELTE_TS);

			const node = new Disknode(TEST_PATH_SVELTE_TS, filer);
			const contents = node.contents;
			expect(vi.mocked(readFileSync)).toHaveBeenCalledWith(TEST_PATH_SVELTE_TS, 'utf8');
			expect(contents).toBe(TEST_CONTENT_SVELTE_TS);
		});

		test('loads Svelte JavaScript module contents', () => {
			const mock_stats = create_mock_stats({size: 100});
			vi.mocked(lstatSync).mockReturnValue(mock_stats);
			vi.mocked(readFileSync).mockReturnValue(TEST_CONTENT_SVELTE_JS);

			const node = new Disknode(TEST_PATH_SVELTE_JS, filer);
			const contents = node.contents;
			expect(vi.mocked(readFileSync)).toHaveBeenCalledWith(TEST_PATH_SVELTE_JS, 'utf8');
			expect(contents).toBe(TEST_CONTENT_SVELTE_JS);
		});

		test('caches contents for small files', () => {
			const mock_stats = create_mock_stats({size: 100});
			vi.mocked(lstatSync).mockReturnValue(mock_stats);
			vi.mocked(readFileSync).mockReturnValue(TEST_CONTENT_TS);

			const node = new Disknode(TEST_PATH_TS, filer);
			const contents1 = node.contents;
			const contents2 = node.contents;

			expect(vi.mocked(readFileSync)).toHaveBeenCalledTimes(1);
			expect(contents1).toBe(contents2);
		});

		test('does not cache large files', () => {
			const large_stats = create_mock_stats({size: 15 * 1024 * 1024}); // 15MB
			vi.mocked(lstatSync).mockReturnValue(large_stats);
			vi.mocked(readFileSync).mockReturnValue(TEST_LARGE_CONTENT);

			const node = new Disknode(TEST_LARGE_FILE_PATH, filer);
			const contents1 = node.contents;
			const contents2 = node.contents;

			expect(vi.mocked(readFileSync)).toHaveBeenCalledTimes(2);
			expect(contents1).toBe(TEST_LARGE_CONTENT);
			expect(contents2).toBe(TEST_LARGE_CONTENT);
		});

		test('returns null for directories', () => {
			const dir_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => true,
			});
			vi.mocked(lstatSync).mockReturnValue(dir_stats);

			const node = new Disknode(TEST_DIR_PATH, filer);
			const contents = node.contents;

			expect(contents).toBe(null);
			expect(vi.mocked(readFileSync)).not.toHaveBeenCalled();
		});

		test('returns null for symlinks pointing to directories', () => {
			const symlink_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => false,
				isSymbolicLink: () => true,
			});
			const dir_stats = create_mock_stats({
				isFile: () => false,
				isDirectory: () => true,
			});

			// Mock symlink stats first, then target directory stats
			vi.mocked(lstatSync).mockReturnValueOnce(symlink_stats);
			vi.mocked(realpathSync).mockReturnValue('/test/somedir');
			vi.mocked(lstatSync).mockReturnValueOnce(dir_stats);

			const node = new Disknode(TEST_SYMLINK_PATH, filer);

			const contents = node.contents;
			expect(contents).toBe(null);
			expect(vi.mocked(realpathSync)).toHaveBeenCalledWith(TEST_SYMLINK_PATH);
		});

		test('handles empty files', () => {
			const mock_stats = create_mock_stats({size: 0});
			vi.mocked(lstatSync).mockReturnValue(mock_stats);
			vi.mocked(readFileSync).mockReturnValue('');

			const node = new Disknode(TEST_PATH_TS, filer);
			const contents = node.contents;

			expect(contents).toBe('');
			expect(vi.mocked(readFileSync)).toHaveBeenCalledWith(TEST_PATH_TS, 'utf8');
		});

		test('handles read errors gracefully', () => {
			const mock_stats = create_mock_stats();
			vi.mocked(lstatSync).mockReturnValue(mock_stats);
			vi.mocked(readFileSync).mockImplementation(() => {
				throw new Error('Permission denied');
			});

			const node = new Disknode(TEST_PATH_TS, filer);
			const contents = node.contents;

			expect(contents).toBe(null);
		});
	});

	describe('cache invalidation', () => {
		test('invalidates all cached properties', () => {
			const mock_stats = create_mock_stats({size: 100});
			vi.mocked(lstatSync).mockReturnValue(mock_stats);
			vi.mocked(readFileSync).mockReturnValue(TEST_CONTENT_TS);
			vi.mocked(realpathSync).mockReturnValue(TEST_PATH_TS);

			const node = new Disknode(TEST_PATH_TS, filer);

			// Access properties to cache them
			node.stats;
			node.contents;
			node.realpath;

			expect(vi.mocked(lstatSync)).toHaveBeenCalledTimes(1);
			expect(vi.mocked(readFileSync)).toHaveBeenCalledTimes(1);
			expect(vi.mocked(realpathSync)).toHaveBeenCalledTimes(0); // not a symlink

			// Invalidate
			node.invalidate();

			// Change mock values
			const new_stats = create_mock_stats({size: 200});
			vi.mocked(lstatSync).mockReturnValue(new_stats);
			vi.mocked(readFileSync).mockReturnValue('new content');

			// Access again - should reload
			const stats2 = node.stats;
			const contents2 = node.contents;

			expect(vi.mocked(lstatSync)).toHaveBeenCalledTimes(2);
			expect(vi.mocked(readFileSync)).toHaveBeenCalledTimes(2);
			expect(stats2).toBe(new_stats);
			expect(contents2).toBe('new content');
		});
	});

	describe('realpath resolution', () => {
		test('returns id for regular files', () => {
			const mock_stats = create_mock_stats();
			vi.mocked(lstatSync).mockReturnValue(mock_stats);

			const node = new Disknode(TEST_PATH_TS, filer);
			expect(node.realpath).toBe(TEST_PATH_TS);
			expect(vi.mocked(realpathSync)).not.toHaveBeenCalled();
		});

		test('resolves symlinks', () => {
			const symlink_stats = create_mock_stats({
				isFile: () => false,
				isSymbolicLink: () => true,
			});
			vi.mocked(lstatSync).mockReturnValue(symlink_stats);
			vi.mocked(realpathSync).mockReturnValue(TEST_PATH_TS);

			const node = new Disknode(TEST_SYMLINK_PATH, filer);
			expect(node.realpath).toBe(TEST_PATH_TS);
			expect(vi.mocked(realpathSync)).toHaveBeenCalledWith(TEST_SYMLINK_PATH);
		});

		test('handles broken symlinks', () => {
			const symlink_stats = create_mock_stats({
				isFile: () => false,
				isSymbolicLink: () => true,
			});
			vi.mocked(lstatSync).mockReturnValue(symlink_stats);
			vi.mocked(realpathSync).mockImplementation(() => {
				throw new Error('ENOENT');
			});

			const node = new Disknode(TEST_SYMLINK_PATH, filer);
			expect(node.realpath).toBe(TEST_SYMLINK_PATH);
		});

		test('caches realpath results', () => {
			const symlink_stats = create_mock_stats({
				isFile: () => false,
				isSymbolicLink: () => true,
			});
			vi.mocked(lstatSync).mockReturnValue(symlink_stats);
			vi.mocked(realpathSync).mockReturnValue(TEST_PATH_TS);

			const node = new Disknode(TEST_SYMLINK_PATH, filer);
			const realpath1 = node.realpath;
			const realpath2 = node.realpath;

			expect(realpath1).toBe(TEST_PATH_TS);
			expect(realpath2).toBe(TEST_PATH_TS);
			expect(vi.mocked(realpathSync)).toHaveBeenCalledTimes(1);
		});

		test('returns id for non-existent files', () => {
			vi.mocked(lstatSync).mockImplementation(() => {
				throw new Error('ENOENT');
			});

			const node = new Disknode(TEST_PATH_TS, filer);
			expect(node.realpath).toBe(TEST_PATH_TS);
			expect(vi.mocked(realpathSync)).not.toHaveBeenCalled();
		});
	});

	describe('dependency management', () => {
		test('adds dependencies bidirectionally', () => {
			const node_ts = new Disknode(TEST_PATH_TS, filer);
			const node_js = new Disknode(TEST_PATH_JS, filer);

			node_js.add_dependency(node_ts);

			expect(node_js.dependencies.has(TEST_PATH_TS)).toBe(true);
			expect(node_js.dependencies.get(TEST_PATH_TS)).toBe(node_ts);
			expect(node_ts.dependents.has(TEST_PATH_JS)).toBe(true);
			expect(node_ts.dependents.get(TEST_PATH_JS)).toBe(node_js);
		});

		test('removes dependencies bidirectionally', () => {
			const node_ts = new Disknode(TEST_PATH_TS, filer);
			const node_js = new Disknode(TEST_PATH_JS, filer);

			node_js.add_dependency(node_ts);
			node_js.remove_dependency(node_ts);

			expect(node_js.dependencies.has(TEST_PATH_TS)).toBe(false);
			expect(node_ts.dependents.has(TEST_PATH_JS)).toBe(false);
		});
	});

	describe('node relationships', () => {
		test('tracks parent-child relationships', () => {
			const parent = new Disknode(TEST_DIR_PATH, filer);
			const child = new Disknode(TEST_PATH_TS, filer);

			child.parent = parent;
			parent.children.set('a.ts', child);

			expect(child.parent).toBe(parent);
			expect(parent.children.get('a.ts')).toBe(child);
			expect(parent.get_child('a.ts')).toBe(child);
		});

		test('gets ancestors', () => {
			const root = new Disknode('/test', filer);
			const dir = new Disknode(TEST_DIR_PATH, filer);
			const file = new Disknode(TEST_PATH_TS, filer);

			dir.parent = root;
			file.parent = dir;

			const ancestors = file.get_ancestors();
			expect(ancestors).toEqual([dir, root]);
		});

		test('gets descendants', () => {
			const dir = new Disknode(TEST_DIR_PATH, filer);
			const file_ts = new Disknode(TEST_PATH_TS, filer);
			const file_js = new Disknode(TEST_PATH_JS, filer);
			const file_svelte = new Disknode(TEST_PATH_SVELTE, filer);

			dir.children.set('a.ts', file_ts);
			dir.children.set('b.js', file_js);
			dir.children.set('c.svelte', file_svelte);

			const descendants = dir.get_descendants();
			expect(descendants).toContain(file_ts);
			expect(descendants).toContain(file_js);
			expect(descendants).toContain(file_svelte);
			expect(descendants).toHaveLength(3);
		});

		test('checks ancestor relationships', () => {
			const root = new Disknode('/test', filer);
			const dir = new Disknode(TEST_DIR_PATH, filer);
			const file = new Disknode(TEST_PATH_TS, filer);
			const unrelated = new Disknode('/other/file.ts', filer);

			dir.parent = root;
			file.parent = dir;

			expect(root.is_ancestor_of(file)).toBe(true);
			expect(dir.is_ancestor_of(file)).toBe(true);
			expect(file.is_ancestor_of(dir)).toBe(false);
			expect(root.is_ancestor_of(unrelated)).toBe(false);
		});

		test('calculates relative paths between disknodes', () => {
			const root = new Disknode('/test', filer);
			const dir_a = new Disknode('/test/a', filer);
			const dir_b = new Disknode('/test/b', filer);
			const file_a = new Disknode('/test/a/file.ts', filer);
			const file_b = new Disknode('/test/b/other.ts', filer);

			dir_a.parent = root;
			dir_b.parent = root;
			file_a.parent = dir_a;
			file_b.parent = dir_b;

			expect(file_a.relative_to(file_b)).toBe('../../b/other.ts');
			expect(file_b.relative_to(file_a)).toBe('../../a/file.ts');
			expect(dir_a.relative_to(file_a)).toBe('file.ts');
			expect(file_a.relative_to(dir_a)).toBe('..');
		});

		test('returns null for unrelated disknodes', () => {
			const node_a = new Disknode('/test/a.ts', filer);
			const node_b = new Disknode('/other/b.ts', filer);

			expect(node_a.relative_to(node_b)).toBe(null);
		});

		test('handles same node', () => {
			const node = new Disknode('/test/a/file.ts', filer);
			expect(node.relative_to(node)).toBe('');
		});

		test('handles parent to child relationship', () => {
			const root = new Disknode('/test', filer);
			const dir = new Disknode('/test/subdir', filer);
			const file = new Disknode('/test/subdir/file.ts', filer);

			dir.parent = root;
			file.parent = dir;

			expect(root.relative_to(file)).toBe('subdir/file.ts');
			expect(dir.relative_to(file)).toBe('file.ts');
		});

		test('handles child to parent relationship', () => {
			const root = new Disknode('/test', filer);
			const dir = new Disknode('/test/subdir', filer);
			const file = new Disknode('/test/subdir/file.ts', filer);

			dir.parent = root;
			file.parent = dir;

			expect(file.relative_to(root)).toBe('../..');
			expect(file.relative_to(dir)).toBe('..');
		});

		test('handles complex nested paths', () => {
			const root = new Disknode('/project', filer);
			const src = new Disknode('/project/src', filer);
			const lib = new Disknode('/project/src/lib', filer);
			const tests = new Disknode('/project/tests', filer);
			const unit = new Disknode('/project/tests/unit', filer);

			const lib_file = new Disknode('/project/src/lib/utils.ts', filer);
			const test_file = new Disknode('/project/tests/unit/utils.test.ts', filer);

			// Set up relationships
			src.parent = root;
			lib.parent = src;
			tests.parent = root;
			unit.parent = tests;
			lib_file.parent = lib;
			test_file.parent = unit;

			expect(lib_file.relative_to(test_file)).toBe('../../../tests/unit/utils.test.ts');
			expect(test_file.relative_to(lib_file)).toBe('../../../src/lib/utils.ts');
		});

		test('handles sibling directories', () => {
			const root = new Disknode('/test', filer);
			const dir_a = new Disknode('/test/a', filer);
			const dir_b = new Disknode('/test/b', filer);

			dir_a.parent = root;
			dir_b.parent = root;

			expect(dir_a.relative_to(dir_b)).toBe('../b');
			expect(dir_b.relative_to(dir_a)).toBe('../a');
		});

		test('relative_from works as inverse of relative_to', () => {
			const root = new Disknode('/test', filer);
			const dir_a = new Disknode('/test/a', filer);
			const dir_b = new Disknode('/test/b', filer);
			const file_a = new Disknode('/test/a/file.ts', filer);
			const file_b = new Disknode('/test/b/other.ts', filer);

			dir_a.parent = root;
			dir_b.parent = root;
			file_a.parent = dir_a;
			file_b.parent = dir_b;

			// relative_to: from file_a to file_b
			expect(file_a.relative_to(file_b)).toBe('../../b/other.ts');
			// relative_from: from file_b to file_a (same as file_b.relative_to(file_a))
			expect(file_a.relative_from(file_b)).toBe('../../a/file.ts');
			expect(file_a.relative_from(file_b)).toBe(file_b.relative_to(file_a));

			// Test with parent-child relationships
			expect(dir_a.relative_to(file_a)).toBe('file.ts');
			expect(dir_a.relative_from(file_a)).toBe('..');
			expect(dir_a.relative_from(file_a)).toBe(file_a.relative_to(dir_a));
		});
	});

	describe('import parsing', () => {
		test('parses imports for TypeScript files', () => {
			const mock_stats = create_mock_stats();
			vi.mocked(lstatSync).mockReturnValue(mock_stats);
			vi.mocked(readFileSync).mockReturnValue(
				'import {a} from "./a.js";\nimport {b} from "./b.js";',
			);

			const node = new Disknode(TEST_PATH_TS, filer);
			const dep_a = new Disknode('/test/path/a.js', filer);
			const dep_b = new Disknode('/test/path/b.js', filer);

			// Mock parse_imports to return expected imports for this test
			vi.mocked(filer.parse_imports).mockReturnValue(['./a.js', './b.js']);

			// Mock filer to return our dependency disknodes
			vi.mocked(filer.get_disknode).mockImplementation((id: Path_Id) => {
				if (id === '/test/path/a.js') return dep_a;
				if (id === '/test/path/b.js') return dep_b;
				return new Disknode(id, filer);
			});

			// Access imports to trigger parsing
			const imports = node.imports;

			expect(imports).toBeTruthy();
			expect(imports?.has('./a.js')).toBe(true);
			expect(imports?.has('./b.js')).toBe(true);
		});

		test('parses imports for JavaScript files', () => {
			const mock_stats = create_mock_stats();
			vi.mocked(lstatSync).mockReturnValue(mock_stats);
			vi.mocked(readFileSync).mockReturnValue(TEST_CONTENT_JS);

			const node = new Disknode(TEST_PATH_JS, filer);
			const dep_a = new Disknode('/test/path/a.js', filer);

			// Mock parse_imports to return expected imports for this test
			vi.mocked(filer.parse_imports).mockReturnValue(['./a.js']);

			// Mock filer to return our dependency disknodes
			vi.mocked(filer.get_disknode).mockImplementation((id: Path_Id) => {
				if (id === '/test/path/a.js') return dep_a;
				return new Disknode(id, filer);
			});

			// Access imports to trigger parsing
			const imports = node.imports;

			expect(imports).toBeTruthy();
			expect(imports?.has('./a.js')).toBe(true);
		});

		test('parses imports for Svelte files', () => {
			const mock_stats = create_mock_stats();
			vi.mocked(lstatSync).mockReturnValue(mock_stats);
			vi.mocked(readFileSync).mockReturnValue(TEST_CONTENT_SVELTE);

			const node = new Disknode(TEST_PATH_SVELTE, filer);
			const dep_a = new Disknode('/test/path/a.js', filer);

			// Mock parse_imports to return expected imports for this test
			vi.mocked(filer.parse_imports).mockReturnValue(['./a.js']);

			// Mock filer to return our dependency disknodes
			vi.mocked(filer.get_disknode).mockImplementation((id: Path_Id) => {
				if (id === '/test/path/a.js') return dep_a;
				return new Disknode(id, filer);
			});

			// Access imports to trigger parsing
			const imports = node.imports;

			expect(imports).toBeTruthy();
			expect(imports?.has('./a.js')).toBe(true);
		});

		test('parses imports for Svelte TypeScript modules', () => {
			const mock_stats = create_mock_stats();
			vi.mocked(lstatSync).mockReturnValue(mock_stats);
			vi.mocked(readFileSync).mockReturnValue(TEST_CONTENT_SVELTE_TS);

			const node = new Disknode(TEST_PATH_SVELTE_TS, filer);
			const dep_store = new Disknode('/node_modules/svelte/store/index.js', filer);

			// Mock parse_imports to return expected imports for this test
			vi.mocked(filer.parse_imports).mockReturnValue(['svelte/store']);

			// Mock filer to return our dependency disknodes
			vi.mocked(filer.get_disknode).mockImplementation((id: Path_Id) => {
				if (id === '/node_modules/svelte/store/index.js') return dep_store;
				return new Disknode(id, filer);
			});

			// Access imports to trigger parsing
			const imports = node.imports;

			expect(imports).toBeTruthy();
			expect(imports?.has('svelte/store')).toBe(true);
		});

		test('parses imports for Svelte JavaScript modules', () => {
			const mock_stats = create_mock_stats();
			vi.mocked(lstatSync).mockReturnValue(mock_stats);
			vi.mocked(readFileSync).mockReturnValue(TEST_CONTENT_SVELTE_JS);

			const node = new Disknode(TEST_PATH_SVELTE_JS, filer);
			const dep_store = new Disknode('/node_modules/svelte/store/index.js', filer);

			// Mock parse_imports to return expected imports for this test
			vi.mocked(filer.parse_imports).mockReturnValue(['svelte/store']);

			// Mock filer to return our dependency disknodes
			vi.mocked(filer.get_disknode).mockImplementation((id: Path_Id) => {
				if (id === '/node_modules/svelte/store/index.js') return dep_store;
				return new Disknode(id, filer);
			});

			// Access imports to trigger parsing
			const imports = node.imports;

			expect(imports).toBeTruthy();
			expect(imports?.has('svelte/store')).toBe(true);
		});

		test('returns null for non-importable files', () => {
			const mock_stats = create_mock_stats();
			vi.mocked(lstatSync).mockReturnValue(mock_stats);
			vi.mocked(readFileSync).mockReturnValue(TEST_CONTENT_TXT);

			const node = new Disknode(TEST_PATH_TXT, filer);
			expect(node.imports).toBe(null);

			const json_disknode = new Disknode(TEST_PATH_JSON, filer);
			vi.mocked(readFileSync).mockReturnValue(TEST_CONTENT_JSON);
			expect(json_disknode.imports).toBe(null);
		});
	});

	describe('constants', () => {
		test('MAX_CACHED_SIZE is 10MB', () => {
			expect(DISKNODE_MAX_CACHED_SIZE).toBe(10 * 1024 * 1024);
		});
	});

	describe('edge cases and additional coverage', () => {
		test('handles invalidation properly', () => {
			const mock_stats_v1 = create_mock_stats({size: 100, mtimeMs: 1000});
			const mock_stats_v2 = create_mock_stats({size: 200, mtimeMs: 2000});

			vi.mocked(lstatSync).mockReturnValueOnce(mock_stats_v1);
			vi.mocked(readFileSync).mockReturnValueOnce('content v1');

			const node = new Disknode(TEST_PATH_TS, filer);

			// First access
			expect(node.size).toBe(100);
			expect(node.mtime).toBe(1000);
			expect(node.contents).toBe('content v1');

			// Change mocks and invalidate
			vi.mocked(lstatSync).mockReturnValueOnce(mock_stats_v2);
			vi.mocked(readFileSync).mockReturnValueOnce('content v2');
			node.invalidate();

			// Second access should reload
			expect(node.size).toBe(200);
			expect(node.mtime).toBe(2000);
			expect(node.contents).toBe('content v2');
		});

		test('detects file extensions correctly', () => {
			const tests = [
				{path: '/test/file.ts', ext: '.ts'},
				{path: '/test/file.js', ext: '.js'},
				{path: '/test/file.mts', ext: '.mts'},
				{path: '/test/file.cjs', ext: '.cjs'},
				{path: '/test/file.svelte', ext: '.svelte'},
				{path: '/test/file.json', ext: '.json'},
				{path: '/test/file', ext: ''},
				{path: '/test/.hidden', ext: ''},
				{path: '/test/file.test.ts', ext: '.ts'},
			];

			for (const {path, ext} of tests) {
				const node = new Disknode(path, filer);
				expect(node.extension).toBe(ext);
			}
		});

		test('correctly identifies file types', () => {
			const ts_files = ['/test/a.ts', '/test/b.tsx', '/test/c.mts', '/test/d.cts'];
			const js_files = ['/test/a.js', '/test/b.jsx', '/test/c.mjs', '/test/d.cjs'];
			const svelte_files = ['/test/Component.svelte'];
			const svelte_module_ts_files = ['/test/store.svelte.ts', '/test/utils.svelte.ts'];
			const svelte_module_js_files = ['/test/helpers.svelte.js', '/test/actions.svelte.js'];
			const other_files = ['/test/data.json', '/test/readme.txt', '/test/image.png'];

			for (const path of ts_files) {
				const node = new Disknode(path, filer);
				expect(node.is_typescript).toBe(true);
				expect(node.is_js).toBe(false);
				expect(node.is_svelte).toBe(false);
				expect(node.is_svelte_module).toBe(false);
				expect(node.is_importable).toBe(true);
			}

			for (const path of js_files) {
				const node = new Disknode(path, filer);
				expect(node.is_typescript).toBe(false);
				expect(node.is_js).toBe(true);
				expect(node.is_svelte).toBe(false);
				expect(node.is_svelte_module).toBe(false);
				expect(node.is_importable).toBe(true);
			}

			for (const path of svelte_files) {
				const node = new Disknode(path, filer);
				expect(node.is_typescript).toBe(false);
				expect(node.is_js).toBe(false);
				expect(node.is_svelte).toBe(true);
				expect(node.is_svelte_module).toBe(false);
				expect(node.is_importable).toBe(true);
			}

			for (const path of svelte_module_ts_files) {
				const node = new Disknode(path, filer);
				expect(node.is_typescript).toBe(true);
				expect(node.is_js).toBe(false);
				expect(node.is_svelte).toBe(false);
				expect(node.is_svelte_module).toBe(true);
				expect(node.is_importable).toBe(true);
			}

			for (const path of svelte_module_js_files) {
				const node = new Disknode(path, filer);
				expect(node.is_typescript).toBe(false);
				expect(node.is_js).toBe(true);
				expect(node.is_svelte).toBe(false);
				expect(node.is_svelte_module).toBe(true);
				expect(node.is_importable).toBe(true);
			}

			for (const path of other_files) {
				const node = new Disknode(path, filer);
				expect(node.is_typescript).toBe(false);
				expect(node.is_js).toBe(false);
				expect(node.is_svelte).toBe(false);
				expect(node.is_svelte_module).toBe(false);
				expect(node.is_importable).toBe(false);
			}
		});

		test('handles ancestor-descendant relationships correctly', () => {
			const root = new Disknode('/test', filer);
			const level1 = new Disknode('/test/level1', filer);
			const level2 = new Disknode('/test/level1/level2', filer);
			const level3 = new Disknode('/test/level1/level2/level3', filer);
			const unrelated = new Disknode('/other/file', filer);

			// Set up parent relationships
			level1.parent = root;
			level2.parent = level1;
			level3.parent = level2;

			// Test ancestor relationships
			expect(root.is_ancestor_of(level1)).toBe(true);
			expect(root.is_ancestor_of(level2)).toBe(true);
			expect(root.is_ancestor_of(level3)).toBe(true);
			expect(level1.is_ancestor_of(level2)).toBe(true);
			expect(level1.is_ancestor_of(level3)).toBe(true);
			expect(level2.is_ancestor_of(level3)).toBe(true);

			// Test non-ancestor relationships
			expect(level3.is_ancestor_of(root)).toBe(false);
			expect(level2.is_ancestor_of(level1)).toBe(false);
			expect(root.is_ancestor_of(unrelated)).toBe(false);
			expect(level1.is_ancestor_of(root)).toBe(false);

			// Test ancestors
			const level3_ancestors = level3.get_ancestors();
			expect(level3_ancestors).toEqual([level2, level1, root]);

			const level1_ancestors = level1.get_ancestors();
			expect(level1_ancestors).toEqual([root]);

			const root_ancestors = root.get_ancestors();
			expect(root_ancestors).toEqual([]);
		});

		test('manages children correctly', () => {
			const parent = new Disknode('/test/parent', filer);
			const child1 = new Disknode('/test/parent/child1.ts', filer);
			const child2 = new Disknode('/test/parent/child2.ts', filer);

			parent.children.set('child1.ts', child1);
			parent.children.set('child2.ts', child2);

			expect(parent.get_child('child1.ts')).toBe(child1);
			expect(parent.get_child('child2.ts')).toBe(child2);
			expect(parent.get_child('nonexistent.ts')).toBe(undefined);

			const descendants = parent.get_descendants();
			expect(descendants).toContain(child1);
			expect(descendants).toContain(child2);
			expect(descendants).toHaveLength(2);
		});

		test('handles complex Svelte module paths', () => {
			const complex_paths = [
				'/project/src/lib/stores/user.svelte.ts',
				'/deep/nested/path/component.svelte.js',
				'/test/file.with.dots.svelte.ts',
				'/another/path/kebab-case.svelte.js',
				'/camelCase/file.svelte.ts',
				'/PascalCase/Component.svelte.js',
				'/numbers123/file456.svelte.ts',
				'/special_chars/file_name.svelte.js',
			];

			for (const path of complex_paths) {
				const node = new Disknode(path, filer);
				expect(node.is_svelte_module).toBe(true);
				expect(node.is_svelte).toBe(false);
				expect(node.is_importable).toBe(true);

				if (path.endsWith('.ts')) {
					expect(node.is_typescript).toBe(true);
					expect(node.is_js).toBe(false);
					expect(node.extension).toBe('.ts');
				} else {
					expect(node.is_typescript).toBe(false);
					expect(node.is_js).toBe(true);
					expect(node.extension).toBe('.js');
				}
			}
		});

		test('distinguishes Svelte files from Svelte modules', () => {
			const svelte_vs_module_pairs = [
				{svelte: '/test/Component.svelte', module: '/test/Component.svelte.ts'},
				{svelte: '/src/Button.svelte', module: '/src/Button.svelte.js'},
				{svelte: '/lib/Modal.svelte', module: '/lib/modal.svelte.ts'},
			];

			for (const {svelte, module} of svelte_vs_module_pairs) {
				const svelte_node = new Disknode(svelte, filer);
				const module_node = new Disknode(module, filer);

				// Svelte file assertions
				expect(svelte_node.is_svelte).toBe(true);
				expect(svelte_node.is_svelte_module).toBe(false);
				expect(svelte_node.extension).toBe('.svelte');

				// Svelte module assertions
				expect(module_node.is_svelte).toBe(false);
				expect(module_node.is_svelte_module).toBe(true);
				expect(module_node.extension).not.toBe('.svelte');

				// Both should be importable
				expect(svelte_node.is_importable).toBe(true);
				expect(module_node.is_importable).toBe(true);
			}
		});
	});
});
