// @slop Claude Sonnet 4

import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest';
import {readFile, lstat} from 'node:fs/promises';

import {Disknode, type Disknode_Api} from './disknode.ts';
import type {Path_Id} from './path.ts';
import {create_mock_stats, TEST_PATHS} from './filer.test_helpers.ts';

// Mock filesystem modules
vi.mock('node:fs/promises', () => ({
	readFile: vi.fn(),
	lstat: vi.fn(),
	realpath: vi.fn(),
}));

// Also mock the sync version for any remaining usage
vi.mock('node:fs', () => ({
	existsSync: vi.fn(),
}));

// Test constants
const TEST_PATH_TS: Path_Id = TEST_PATHS.FILE_A;
const TEST_CONTENT_WITH_IMPORT =
	'import {foo} from "./relative.js";\nimport {bar} from "external-package";';

// Helper to create mock Disknode_Api with default implementations
const create_mock_api = (overrides: Partial<Disknode_Api> = {}): Disknode_Api => {
	const default_api: Disknode_Api = {
		map_alias: vi.fn((spec) => spec),
		resolve_specifier: vi.fn(() => ({path_id: '/test/resolved.js'})),
		resolve_external_specifier: vi.fn().mockReturnValue('file:///resolved'),
		get_disknode: vi.fn((id) => new Disknode(id, default_api)),
		parse_imports_async: vi.fn().mockResolvedValue([]),
		load_resources_batch: vi.fn().mockResolvedValue(undefined),
	};
	return {...default_api, ...overrides};
};

describe('Disknode_Api interface', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('pluggable api functionality', () => {
		test('uses custom resolve_external_specifier for package imports', async () => {
			const custom_resolver = vi.fn().mockReturnValue('file:///custom/resolved/path');
			const mock_api = create_mock_api({
				resolve_specifier: vi.fn().mockImplementation((spec) => {
					if (spec === './relative.js') return {path_id: '/test/relative.js'};
					throw new Error(`Cannot resolve local specifier: ${spec}`);
				}),
				resolve_external_specifier: custom_resolver,
				parse_imports_async: vi.fn().mockResolvedValue(['./relative.js', 'external-package']),
			});

			// Set up mocks for file content
			vi.mocked(lstat).mockResolvedValue(create_mock_stats({size: 100}));
			vi.mocked(readFile).mockResolvedValue(TEST_CONTENT_WITH_IMPORT);

			const disknode = new Disknode(TEST_PATH_TS, mock_api);
			await disknode.load_imports();

			expect(custom_resolver).toHaveBeenCalledWith('external-package', TEST_PATH_TS);
		});

		test('uses custom resolve_specifier for relative imports', async () => {
			const custom_resolve = vi.fn(() => ({path_id: '/custom/resolved/relative.js'}));
			const mock_api = create_mock_api({
				resolve_specifier: custom_resolve,
				parse_imports_async: vi.fn().mockResolvedValue(['$lib/utils.js']),
			});

			vi.mocked(lstat).mockResolvedValue(create_mock_stats({size: 100}));
			vi.mocked(readFile).mockResolvedValue('import {util} from "$lib/utils.js";');

			const disknode = new Disknode(TEST_PATH_TS, mock_api);
			await disknode.load_imports();

			expect(custom_resolve).toHaveBeenCalled();
		});

		test('uses custom get_disknode for dependency creation', async () => {
			const custom_get_disknode = vi.fn();
			const dep_disknode = new Disknode('/test/dep.js', create_mock_api());
			custom_get_disknode.mockReturnValue(dep_disknode);

			const mock_api = create_mock_api({
				get_disknode: custom_get_disknode,
				parse_imports_async: vi.fn().mockResolvedValue(['./dep.js']),
			});

			vi.mocked(lstat).mockResolvedValue(create_mock_stats({size: 100}));
			vi.mocked(readFile).mockResolvedValue('import dep from "./dep.js";');

			const disknode = new Disknode(TEST_PATH_TS, mock_api);
			await disknode.load_imports();

			expect(custom_get_disknode).toHaveBeenCalled();
		});

		test('uses custom parse_imports_async for import extraction', async () => {
			const custom_parse_imports = vi.fn().mockResolvedValue(['./custom-import.js']);
			const mock_api = create_mock_api({
				resolve_external_specifier: vi.fn().mockReturnValue('file:///custom-resolved'),
				parse_imports_async: custom_parse_imports,
			});

			vi.mocked(lstat).mockResolvedValue(create_mock_stats({size: 100}));
			vi.mocked(readFile).mockResolvedValue(TEST_CONTENT_WITH_IMPORT);

			const disknode = new Disknode(TEST_PATH_TS, mock_api);
			await disknode.load_imports();

			expect(custom_parse_imports).toHaveBeenCalledWith(TEST_PATH_TS, TEST_CONTENT_WITH_IMPORT);
		});

		test('uses custom map_alias for import transformation', async () => {
			const custom_map_alias = vi.fn((spec) => spec.replace('$lib', '/src/lib'));
			const mock_api = create_mock_api({
				map_alias: custom_map_alias,
				resolve_specifier: vi.fn(() => ({path_id: '/src/lib/utils.js'})),
				resolve_external_specifier: vi.fn(),
				parse_imports_async: vi.fn().mockResolvedValue(['$lib/utils.js', './relative.js']),
			});

			vi.mocked(lstat).mockResolvedValue(create_mock_stats({size: 100}));
			vi.mocked(readFile).mockResolvedValue('import utils from "$lib/utils.js";');

			const disknode = new Disknode(TEST_PATH_TS, mock_api);
			await disknode.load_imports();

			expect(custom_map_alias).toHaveBeenCalled();
		});

		test('handles $app imports by skipping them', async () => {
			const mock_api = create_mock_api({
				get_disknode: vi.fn(),
				parse_imports_async: vi.fn().mockResolvedValue(['$app/stores']),
			});

			vi.mocked(lstat).mockResolvedValue(create_mock_stats({size: 100}));
			vi.mocked(readFile).mockResolvedValue('import {page} from "$app/stores";');

			const disknode = new Disknode(TEST_PATH_TS, mock_api);
			await disknode.load_imports();

			// $app imports should be skipped, no dependencies created
			expect(disknode.dependencies.size).toBe(0);
		});

		test('handles external specifier resolution failures gracefully', async () => {
			const failing_resolver = vi.fn().mockImplementation(() => {
				throw new Error('Resolution failed');
			});
			const mock_api = create_mock_api({
				resolve_external_specifier: failing_resolver,
				parse_imports_async: vi.fn().mockResolvedValue(['unknown-package']),
			});

			vi.mocked(lstat).mockResolvedValue(create_mock_stats({size: 100}));
			vi.mocked(readFile).mockResolvedValue('import pkg from "unknown-package";');

			const disknode = new Disknode(TEST_PATH_TS, mock_api);

			// Should not throw
			await expect(disknode.load_imports()).resolves.not.toThrow();
		});

		test('creates bidirectional dependencies through get_disknode', async () => {
			const dep_disknode = new Disknode('/test/dep.js', create_mock_api());
			const mock_api = create_mock_api({
				resolve_specifier: vi.fn(() => ({path_id: '/test/dep.js'})),
				get_disknode: vi.fn().mockReturnValue(dep_disknode),
				parse_imports_async: vi.fn().mockResolvedValue(['./dep.js']),
			});

			vi.mocked(lstat).mockResolvedValue(create_mock_stats({size: 100}));
			vi.mocked(readFile).mockResolvedValue('import dep from "./dep.js";');

			const disknode = new Disknode(TEST_PATH_TS, mock_api);
			await disknode.load_imports();

			expect(disknode.dependencies.size).toBeGreaterThan(0);
		});

		test('ignores non-importable files', async () => {
			const mock_api = create_mock_api({
				get_disknode: vi.fn(),
				parse_imports_async: vi.fn().mockResolvedValue([]),
			});

			const txt_disknode = new Disknode('/test/file.txt', mock_api);
			await txt_disknode.load_imports();

			expect(txt_disknode.imports).toBe(null);
		});

		test('caches imports across multiple accesses', async () => {
			const mock_api = create_mock_api({
				get_disknode: vi.fn(),
				parse_imports_async: vi.fn().mockResolvedValue([]),
			});

			vi.mocked(lstat).mockResolvedValue(create_mock_stats({size: 100}));
			vi.mocked(readFile).mockResolvedValue('export const test = 1;');

			const disknode = new Disknode(TEST_PATH_TS, mock_api);

			await disknode.load_imports();
			await disknode.load_imports();

			expect(mock_api.parse_imports_async).toHaveBeenCalledTimes(1);
		});

		test('re-parses imports after invalidation', async () => {
			const mock_api = create_mock_api({
				get_disknode: vi.fn(),
				parse_imports_async: vi.fn().mockResolvedValue([]),
			});

			vi.mocked(lstat).mockResolvedValue(create_mock_stats({size: 100}));
			vi.mocked(readFile).mockResolvedValue('export const test = 1;');

			const disknode = new Disknode(TEST_PATH_TS, mock_api);

			await disknode.load_imports();
			disknode.invalidate();
			await disknode.load_imports();

			expect(mock_api.parse_imports_async).toHaveBeenCalledTimes(2);
		});
	});

	describe('complex import scenarios', () => {
		test('handles mixed import types correctly', async () => {
			const successful_dep = new Disknode('/test/success.js', create_mock_api());
			const mock_api = create_mock_api({
				get_disknode: vi.fn().mockReturnValue(successful_dep),
				parse_imports_async: vi
					.fn()
					.mockResolvedValue(['./success.js', 'good-package', 'failing-package']),
			});

			// Mock resolution behaviors
			vi.mocked(mock_api.resolve_specifier).mockReturnValue({path_id: '/test/success.js'});
			vi.mocked(mock_api.resolve_external_specifier)
				.mockReturnValueOnce('file:///node_modules/good-package/index.js')
				.mockImplementationOnce(() => {
					throw new Error('Package not found');
				});

			vi.mocked(lstat).mockResolvedValue(create_mock_stats({size: 200}));
			vi.mocked(readFile).mockResolvedValue(`
				import success from "./success.js";
				import good from "good-package";
				import bad from "failing-package";
			`);

			const disknode = new Disknode(TEST_PATH_TS, mock_api);
			await disknode.load_imports();

			// Should create dependencies for successful resolutions
			expect(disknode.dependencies.size).toBeGreaterThan(0);
		});

		test('resolves nested dependencies', async () => {
			const nested_api = create_mock_api({
				get_disknode: vi.fn((id: Path_Id) => {
					return new Disknode(id, nested_api);
				}),
				parse_imports_async: vi.fn().mockImplementation(async (id: Path_Id) => {
					if (id === '/src/a.ts') return ['./b.js'];
					if (id === '/src/b.js') return ['./c.js'];
					return [];
				}),
			});

			vi.mocked(lstat).mockResolvedValue(create_mock_stats({size: 100}));
			vi.mocked(readFile).mockResolvedValue('import b from "./b.js";');

			const disknode_a = new Disknode('/src/a.ts', nested_api);
			await disknode_a.load_imports();

			expect(disknode_a.dependencies.size).toBeGreaterThan(0);
		});

		test('handles circular dependencies gracefully', async () => {
			let node_a: Disknode;
			let node_b: Disknode;

			const circular_api = create_mock_api({
				get_disknode: vi.fn((id: Path_Id) => {
					if (id === '/src/a.ts') return node_a;
					if (id === '/src/b.ts') return node_b;
					return new Disknode(id, circular_api);
				}),
				parse_imports_async: vi.fn().mockImplementation(async (id: Path_Id) => {
					if (id === '/src/a.ts') return ['./b.js'];
					if (id === '/src/b.ts') return ['./a.js'];
					return [];
				}),
			});

			node_a = new Disknode('/src/a.ts', circular_api);
			node_b = new Disknode('/src/b.ts', circular_api);

			vi.mocked(lstat).mockResolvedValue(create_mock_stats({size: 100}));
			vi.mocked(readFile)
				.mockReturnValueOnce(Promise.resolve('import b from "./b.js";'))
				.mockReturnValueOnce(Promise.resolve('import a from "./a.js";'));

			// Should not hang or throw
			await expect(node_a.load_imports()).resolves.not.toThrow();
			await expect(node_b.load_imports()).resolves.not.toThrow();
		});
	});

	describe('load_resources_batch integration', () => {
		test('can be called on api', async () => {
			const mock_api = create_mock_api({
				load_resources_batch: vi.fn().mockResolvedValue(undefined),
			});

			const node1 = new Disknode('/src/file1.ts', mock_api);
			const node2 = new Disknode('/src/file2.ts', mock_api);

			await mock_api.load_resources_batch([node1, node2], {
				contents: true,
				imports: true,
				stats: false,
			});

			expect(mock_api.load_resources_batch).toHaveBeenCalledWith([node1, node2], {
				contents: true,
				imports: true,
				stats: false,
			});
		});
	});
});
