// @slop Claude Opus 4.1

import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest';
import {readFileSync, lstatSync, realpathSync} from 'node:fs';

import {Disknode} from './disknode.ts';
import type {Filer} from './filer.ts';
import type {Path_Id} from './path.ts';
import {DISKNODE_MAX_CACHED_SIZE} from './disknode_helpers.ts';
import {create_mock_stats, TEST_PATHS} from './filer.test_helpers.ts';

// Mock filesystem modules
vi.mock('node:fs', () => ({
	readFileSync: vi.fn(),
	lstatSync: vi.fn(),
	realpathSync: vi.fn(),
	existsSync: vi.fn(),
}));

// Test constants
const TEST_PATH_TS: Path_Id = TEST_PATHS.FILE_A;
const TEST_PATH_JS: Path_Id = TEST_PATHS.FILE_JS;
const TEST_PATH_SVELTE: Path_Id = '/test/project/src/c.svelte';
const TEST_PATH_SVELTE_TS: Path_Id = '/test/project/src/d.svelte.ts';
const TEST_PATH_SVELTE_JS: Path_Id = '/test/project/src/e.svelte.js';
const TEST_PATH_SVELTE_POSTFIX_TS: Path_Id = '/test/project/src/a.svelte.b.ts';
const TEST_PATH_SVELTE_PREFIX_TS: Path_Id = '/test/project/src/a.b.svelte.ts';
const TEST_PATH_MTS: Path_Id = '/test/project/src/f.mts';
const TEST_PATH_CJS: Path_Id = '/test/project/src/g.cjs';
const TEST_PATH_JSON: Path_Id = TEST_PATHS.JSON_FILE;
const TEST_PATH_TXT: Path_Id = '/test/project/src/readme.txt';
const TEST_DIR_PATH: Path_Id = TEST_PATHS.SOURCE;
const TEST_SYMLINK_PATH: Path_Id = '/test/project/src/symlink';
const TEST_LARGE_FILE_PATH: Path_Id = '/test/project/src/large.txt';

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

// Test helpers
interface FileTypeProperties {
	extension: string;
	is_typescript: boolean;
	is_js: boolean;
	is_svelte: boolean;
	is_svelte_module: boolean;
	is_importable: boolean;
}

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

const setup_stats_test = (stats_options: Record<string, any> = {}) => {
	const mock_stats = create_mock_stats(stats_options);
	vi.mocked(lstatSync).mockReturnValue(mock_stats);
	return mock_stats;
};

const setup_content_test = (content: string, size = 100) => {
	setup_stats_test({size});
	vi.mocked(readFileSync).mockReturnValue(content);
};

const setup_import_test = (
	filer: Filer,
	content: string,
	imports: Array<string>,
	dependencies: Record<string, Path_Id> = {},
) => {
	setup_content_test(content);
	vi.mocked(filer.parse_imports).mockReturnValue(imports);

	vi.mocked(filer.get_disknode).mockImplementation((id: Path_Id) => {
		for (const dep_path of Object.values(dependencies)) {
			if (id === dep_path) {
				return new Disknode(dep_path, filer);
			}
		}
		return new Disknode(id, filer);
	});
};

const expect_file_properties = (disknode: Disknode, expected: FileTypeProperties) => {
	expect(disknode.extension).toBe(expected.extension);
	expect(disknode.is_typescript).toBe(expected.is_typescript);
	expect(disknode.is_js).toBe(expected.is_js);
	expect(disknode.is_svelte).toBe(expected.is_svelte);
	expect(disknode.is_svelte_module).toBe(expected.is_svelte_module);
	expect(disknode.is_importable).toBe(expected.is_importable);
};

const expect_content_loading = (disknode: Disknode, path: Path_Id, expected_content: string) => {
	const contents = disknode.contents;
	expect(vi.mocked(readFileSync)).toHaveBeenCalledWith(path, 'utf8');
	expect(contents).toBe(expected_content);
};

const expect_import_parsing = (disknode: Disknode, expected_imports: Array<string>) => {
	const imports = disknode.imports;
	expect(imports).toBeTruthy();
	for (const import_spec of expected_imports) {
		expect(imports?.has(import_spec)).toBe(true);
	}
};

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
	});

	describe('file type detection', () => {
		const file_type_tests = [
			{
				name: 'TypeScript files',
				cases: [
					{path: TEST_PATH_TS, ext: '.ts'},
					{path: TEST_PATH_MTS, ext: '.mts'},
				],
				expected: {
					extension: '',
					is_typescript: true,
					is_js: false,
					is_svelte: false,
					is_svelte_module: false,
					is_importable: true,
				},
			},
			{
				name: 'JavaScript files',
				cases: [
					{path: TEST_PATH_JS, ext: '.js'},
					{path: TEST_PATH_CJS, ext: '.cjs'},
				],
				expected: {
					extension: '',
					is_typescript: false,
					is_js: true,
					is_svelte: false,
					is_svelte_module: false,
					is_importable: true,
				},
			},
			{
				name: 'Svelte files',
				cases: [{path: TEST_PATH_SVELTE, ext: '.svelte'}],
				expected: {
					extension: '.svelte',
					is_typescript: false,
					is_js: false,
					is_svelte: true,
					is_svelte_module: false,
					is_importable: true,
				},
			},
			{
				name: 'Svelte TypeScript modules',
				cases: [
					{path: TEST_PATH_SVELTE_TS, ext: '.ts'},
					{path: TEST_PATH_SVELTE_POSTFIX_TS, ext: '.ts'},
					{path: TEST_PATH_SVELTE_PREFIX_TS, ext: '.ts'},
				],
				expected: {
					extension: '.ts',
					is_typescript: true,
					is_js: false,
					is_svelte: false,
					is_svelte_module: true,
					is_importable: true,
				},
			},
			{
				name: 'Svelte JavaScript modules',
				cases: [{path: TEST_PATH_SVELTE_JS, ext: '.js'}],
				expected: {
					extension: '.js',
					is_typescript: false,
					is_js: true,
					is_svelte: false,
					is_svelte_module: true,
					is_importable: true,
				},
			},
			{
				name: 'non-importable files',
				cases: [
					{path: TEST_PATH_JSON, ext: '.json'},
					{path: TEST_PATH_TXT, ext: '.txt'},
				],
				expected: {
					extension: '',
					is_typescript: false,
					is_js: false,
					is_svelte: false,
					is_svelte_module: false,
					is_importable: false,
				},
			},
		];

		for (const {name, cases, expected} of file_type_tests) {
			test(`detects ${name}`, () => {
				for (const {path, ext} of cases) {
					const disknode = new Disknode(path, filer);
					expect_file_properties(disknode, {
						...expected,
						extension: ext,
					});
				}
			});
		}
	});

	describe('stats lazy loading and caching', () => {
		test('loads stats lazily on first access', () => {
			const mock_stats = setup_stats_test({size: 123, mtimeMs: 1000});
			const disknode = new Disknode(TEST_PATH_TS, filer);

			expect(vi.mocked(lstatSync)).not.toHaveBeenCalled();
			const stats = disknode.stats;

			expect(vi.mocked(lstatSync)).toHaveBeenCalledWith(TEST_PATH_TS);
			expect(stats).toBe(mock_stats);
			expect(disknode.size).toBe(123);
			expect(disknode.mtime).toBe(1000);
		});

		test('caches stats on subsequent accesses', () => {
			setup_stats_test();
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
			expect(node.stats).toBe(null);
			expect(node.exists).toBe(false);
			expect(node.size).toBe(null);
			expect(node.mtime).toBe(null);
		});

		test('updates kind based on stats', () => {
			setup_stats_test({
				isFile: () => false,
				isDirectory: () => true,
			});

			const node = new Disknode(TEST_DIR_PATH, filer);
			node.stats; // trigger load
			expect(node.kind).toBe('directory');
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
		const content_tests = [
			{name: 'TypeScript files', path: TEST_PATH_TS, content: TEST_CONTENT_TS},
			{name: 'JavaScript files', path: TEST_PATH_JS, content: TEST_CONTENT_JS},
			{name: 'Svelte files', path: TEST_PATH_SVELTE, content: TEST_CONTENT_SVELTE},
			{
				name: 'Svelte TypeScript modules',
				path: TEST_PATH_SVELTE_TS,
				content: TEST_CONTENT_SVELTE_TS,
			},
			{
				name: 'Svelte JavaScript modules',
				path: TEST_PATH_SVELTE_JS,
				content: TEST_CONTENT_SVELTE_JS,
			},
			{
				name: 'Svelte TypeScript modules with postfix pattern',
				path: TEST_PATH_SVELTE_POSTFIX_TS,
				content: TEST_CONTENT_SVELTE_TS,
			},
			{
				name: 'Svelte TypeScript modules with prefix pattern',
				path: TEST_PATH_SVELTE_PREFIX_TS,
				content: TEST_CONTENT_SVELTE_TS,
			},
		];

		for (const {name, path, content} of content_tests) {
			test(`loads ${name} contents`, () => {
				setup_content_test(content);
				const node = new Disknode(path, filer);
				expect_content_loading(node, path, content);
			});
		}

		test('caches contents for small files', () => {
			setup_content_test(TEST_CONTENT_TS);
			const node = new Disknode(TEST_PATH_TS, filer);

			const contents1 = node.contents;
			const contents2 = node.contents;

			expect(vi.mocked(readFileSync)).toHaveBeenCalledTimes(1);
			expect(contents1).toBe(contents2);
		});

		test('does not cache large files', () => {
			setup_content_test(TEST_LARGE_CONTENT, 15 * 1024 * 1024);
			const node = new Disknode(TEST_LARGE_FILE_PATH, filer);

			node.contents;
			node.contents;

			expect(vi.mocked(readFileSync)).toHaveBeenCalledTimes(2);
		});

		test('returns null for directories', () => {
			setup_stats_test({
				isFile: () => false,
				isDirectory: () => true,
			});

			const node = new Disknode(TEST_DIR_PATH, filer);
			expect(node.contents).toBe(null);
			expect(vi.mocked(readFileSync)).not.toHaveBeenCalled();
		});

		test('handles empty files', () => {
			setup_content_test('', 0);
			const node = new Disknode(TEST_PATH_TS, filer);
			expect_content_loading(node, TEST_PATH_TS, '');
		});

		test('handles read errors gracefully', () => {
			setup_stats_test();
			vi.mocked(readFileSync).mockImplementation(() => {
				throw new Error('Permission denied');
			});

			const node = new Disknode(TEST_PATH_TS, filer);
			expect(node.contents).toBe(null);
		});
	});

	describe('cache invalidation', () => {
		test('invalidates all cached properties', () => {
			setup_content_test(TEST_CONTENT_TS);
			vi.mocked(realpathSync).mockReturnValue(TEST_PATH_TS);

			const node = new Disknode(TEST_PATH_TS, filer);

			// Access properties to cache them
			node.stats;
			node.contents;
			node.realpath;

			expect(vi.mocked(lstatSync)).toHaveBeenCalledTimes(1);
			expect(vi.mocked(readFileSync)).toHaveBeenCalledTimes(1);

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
			setup_stats_test();
			const node = new Disknode(TEST_PATH_TS, filer);
			expect(node.realpath).toBe(TEST_PATH_TS);
			expect(vi.mocked(realpathSync)).not.toHaveBeenCalled();
		});

		test('resolves symlinks', () => {
			setup_stats_test({
				isFile: () => false,
				isSymbolicLink: () => true,
			});
			vi.mocked(realpathSync).mockReturnValue(TEST_PATH_TS);

			const node = new Disknode(TEST_SYMLINK_PATH, filer);
			expect(node.realpath).toBe(TEST_PATH_TS);
			expect(vi.mocked(realpathSync)).toHaveBeenCalledWith(TEST_SYMLINK_PATH);
		});

		test('handles broken symlinks', () => {
			setup_stats_test({
				isFile: () => false,
				isSymbolicLink: () => true,
			});
			vi.mocked(realpathSync).mockImplementation(() => {
				throw new Error('ENOENT');
			});

			const node = new Disknode(TEST_SYMLINK_PATH, filer);
			expect(node.realpath).toBe(TEST_SYMLINK_PATH);
		});

		test('caches realpath results', () => {
			setup_stats_test({
				isFile: () => false,
				isSymbolicLink: () => true,
			});
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

			dir.children.set('a.ts', file_ts);
			dir.children.set('b.js', file_js);

			const descendants = dir.get_descendants();
			expect(descendants).toContain(file_ts);
			expect(descendants).toContain(file_js);
			expect(descendants).toHaveLength(2);
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

			expect(file_a.relative_to(file_b)).toBe('../../b/other.ts');
			expect(file_a.relative_from(file_b)).toBe('../../a/file.ts');
			expect(file_a.relative_from(file_b)).toBe(file_b.relative_to(file_a));
		});
	});

	describe('import parsing', () => {
		const import_tests: Array<{
			name: string;
			path: Path_Id;
			content: string;
			imports: Array<string>;
			dependencies: Record<string, Path_Id>;
		}> = [
			{
				name: 'TypeScript files',
				path: TEST_PATH_TS,
				content: 'import {a} from "./a.js";\nimport {b} from "./b.js";',
				imports: ['./a.js', './b.js'],
				dependencies: {
					'./a.js': '/test/path/a.js',
					'./b.js': '/test/path/b.js',
				},
			},
			{
				name: 'JavaScript files',
				path: TEST_PATH_JS,
				content: TEST_CONTENT_JS,
				imports: ['./a.js'],
				dependencies: {'./a.js': '/test/path/a.js'},
			},
			{
				name: 'Svelte files',
				path: TEST_PATH_SVELTE,
				content: TEST_CONTENT_SVELTE,
				imports: ['./a.js'],
				dependencies: {'./a.js': '/test/path/a.js'},
			},
			{
				name: 'Svelte TypeScript modules',
				path: TEST_PATH_SVELTE_TS,
				content: TEST_CONTENT_SVELTE_TS,
				imports: ['svelte/store'],
				dependencies: {'svelte/store': '/node_modules/svelte/store/index.js'},
			},
			{
				name: 'Svelte JavaScript modules',
				path: TEST_PATH_SVELTE_JS,
				content: TEST_CONTENT_SVELTE_JS,
				imports: ['svelte/store'],
				dependencies: {'svelte/store': '/node_modules/svelte/store/index.js'},
			},
			{
				name: 'Svelte TypeScript modules with postfix pattern',
				path: TEST_PATH_SVELTE_POSTFIX_TS,
				content: TEST_CONTENT_SVELTE_TS,
				imports: ['svelte/store'],
				dependencies: {'svelte/store': '/node_modules/svelte/store/index.js'},
			},
			{
				name: 'Svelte TypeScript modules with prefix pattern',
				path: TEST_PATH_SVELTE_PREFIX_TS,
				content: TEST_CONTENT_SVELTE_TS,
				imports: ['svelte/store'],
				dependencies: {'svelte/store': '/node_modules/svelte/store/index.js'},
			},
		];

		for (const {name, path, content, imports, dependencies} of import_tests) {
			test(`parses imports for ${name}`, () => {
				setup_import_test(filer, content, imports, dependencies);
				const node = new Disknode(path, filer);
				expect_import_parsing(node, imports);
			});
		}

		test('returns null for non-importable files', () => {
			setup_content_test(TEST_CONTENT_TXT);
			const node = new Disknode(TEST_PATH_TXT, filer);
			expect(node.imports).toBe(null);

			const json_disknode = new Disknode(TEST_PATH_JSON, filer);
			setup_content_test(TEST_CONTENT_JSON);
			expect(json_disknode.imports).toBe(null);
		});
	});

	describe('constants', () => {
		test('MAX_CACHED_SIZE is 10MB', () => {
			expect(DISKNODE_MAX_CACHED_SIZE).toBe(10 * 1024 * 1024);
		});
	});
});
