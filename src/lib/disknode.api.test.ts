// @slop Claude Sonnet 4

import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest';
import {readFileSync, lstatSync} from 'node:fs';

import {Disknode, type Disknode_Api} from './disknode.ts';
import type {Path_Id} from './path.ts';

// Mock filesystem modules
vi.mock('node:fs', () => ({
	readFileSync: vi.fn(),
	lstatSync: vi.fn(),
	realpathSync: vi.fn(),
	existsSync: vi.fn(),
}));

// Test constants
const TEST_PATH_TS: Path_Id = '/test/path/a.ts';
const TEST_CONTENT_WITH_IMPORT =
	'import {foo} from "./relative.js";\nimport {bar} from "external-package";';

// Create mock stats
const create_mock_stats = () => ({
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
});

describe('Disknode_Api interface', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('pluggable api functionality', () => {
		test('uses custom resolve_external_specifier for package imports', () => {
			const custom_resolver = vi.fn().mockReturnValue('file:///custom/resolved/path');
			const mock_api: Disknode_Api = {
				map_alias: vi.fn((spec) => spec),
				resolve_specifier: vi.fn(() => ({path_id: '/test/relative.js'})),
				resolve_external_specifier: custom_resolver,
				get_disknode: vi.fn((id) => new Disknode(id, mock_api)),
			};

			const mock_stats = create_mock_stats();
			vi.mocked(lstatSync).mockReturnValue(mock_stats as any);
			vi.mocked(readFileSync).mockReturnValue(TEST_CONTENT_WITH_IMPORT);

			const disknode = new Disknode(TEST_PATH_TS, mock_api);

			// Access imports to trigger dependency resolution
			disknode.imports;

			// Verify custom resolver was called for external specifier
			expect(custom_resolver).toHaveBeenCalledWith('external-package', TEST_PATH_TS);
			expect(mock_api.resolve_specifier).toHaveBeenCalledWith('./relative.js', TEST_PATH_TS);
		});

		test('uses custom map_alias implementation', () => {
			const custom_alias_mapper = vi.fn((spec) => {
				if (spec.startsWith('$lib/')) {
					return '/src/lib/' + spec.slice(5);
				}
				return spec;
			});

			const mock_api: Disknode_Api = {
				map_alias: custom_alias_mapper,
				resolve_specifier: vi.fn(() => ({path_id: '/src/lib/utils.js'})),
				resolve_external_specifier: vi.fn().mockReturnValue('file:///resolved'),
				get_disknode: vi.fn((id) => new Disknode(id, mock_api)),
			};

			const mock_stats = create_mock_stats();
			vi.mocked(lstatSync).mockReturnValue(mock_stats as any);
			vi.mocked(readFileSync).mockReturnValue('import {utils} from "$lib/utils.js";');

			const disknode = new Disknode(TEST_PATH_TS, mock_api);

			// Access imports to trigger alias mapping
			disknode.imports;

			// Verify custom alias mapper was called
			expect(custom_alias_mapper).toHaveBeenCalledWith('$lib/utils.js');
			expect(mock_api.resolve_specifier).toHaveBeenCalledWith('/src/lib/utils.js', TEST_PATH_TS);
		});

		test('uses custom get_disknode implementation', () => {
			const dependency_disknode = new Disknode('/test/dep.js', {} as Disknode_Api);
			const custom_get_disknode = vi.fn().mockReturnValue(dependency_disknode);

			const mock_api: Disknode_Api = {
				map_alias: vi.fn((spec) => spec),
				resolve_specifier: vi.fn(() => ({path_id: '/test/dep.js'})),
				resolve_external_specifier: vi.fn().mockReturnValue('file:///resolved'),
				get_disknode: custom_get_disknode,
			};

			const mock_stats = create_mock_stats();
			vi.mocked(lstatSync).mockReturnValue(mock_stats as any);
			vi.mocked(readFileSync).mockReturnValue('import {dep} from "./dep.js";');

			const disknode = new Disknode(TEST_PATH_TS, mock_api);

			// Access imports to trigger get_disknode
			disknode.imports;

			// Verify custom get_disknode was called
			expect(custom_get_disknode).toHaveBeenCalledWith('/test/dep.js');
			expect(disknode.dependencies.get('/test/dep.js')).toBe(dependency_disknode);
		});

		test('skips builtin modules', () => {
			const mock_api: Disknode_Api = {
				map_alias: vi.fn((spec) => spec),
				resolve_specifier: vi.fn(),
				resolve_external_specifier: vi.fn(),
				get_disknode: vi.fn(),
			};

			const mock_stats = create_mock_stats();
			vi.mocked(lstatSync).mockReturnValue(mock_stats as any);
			vi.mocked(readFileSync).mockReturnValue(
				'import fs from "node:fs";\nimport path from "path";',
			);

			const disknode = new Disknode(TEST_PATH_TS, mock_api);

			// Access imports to trigger processing
			disknode.imports;

			// Builtin modules should not trigger any api calls
			expect(mock_api.resolve_specifier).not.toHaveBeenCalled();
			expect(mock_api.resolve_external_specifier).not.toHaveBeenCalled();
			expect(mock_api.get_disknode).not.toHaveBeenCalled();
		});

		test('skips $app/ imports', () => {
			const mock_api: Disknode_Api = {
				map_alias: vi.fn((spec) => spec),
				resolve_specifier: vi.fn(),
				resolve_external_specifier: vi.fn(),
				get_disknode: vi.fn(),
			};

			const mock_stats = create_mock_stats();
			vi.mocked(lstatSync).mockReturnValue(mock_stats as any);
			vi.mocked(readFileSync).mockReturnValue('import {page} from "$app/stores";');

			const disknode = new Disknode(TEST_PATH_TS, mock_api);

			// Access imports to trigger processing
			disknode.imports;

			// $app/ imports should not trigger any api calls
			expect(mock_api.resolve_specifier).not.toHaveBeenCalled();
			expect(mock_api.resolve_external_specifier).not.toHaveBeenCalled();
			expect(mock_api.get_disknode).not.toHaveBeenCalled();
		});

		test('handles resolve_external_specifier failures gracefully', () => {
			const failing_resolver = vi.fn().mockImplementation(() => {
				throw new Error('Package not found');
			});

			const mock_api: Disknode_Api = {
				map_alias: vi.fn((spec) => spec),
				resolve_specifier: vi.fn(() => ({path_id: '/test/relative.js'})),
				resolve_external_specifier: failing_resolver,
				get_disknode: vi.fn((id) => new Disknode(id, mock_api)),
			};

			const mock_stats = create_mock_stats();
			vi.mocked(lstatSync).mockReturnValue(mock_stats as any);
			vi.mocked(readFileSync).mockReturnValue('import {pkg} from "unknown-package";');

			const disknode = new Disknode(TEST_PATH_TS, mock_api);

			// Should not throw when resolver fails
			expect(() => disknode.imports).not.toThrow();

			// Should have attempted to resolve
			expect(failing_resolver).toHaveBeenCalledWith('unknown-package', TEST_PATH_TS);

			// Should not have created dependency for failed resolution
			expect(mock_api.get_disknode).not.toHaveBeenCalled();
		});

		test('maintains bidirectional dependency relationships through api', () => {
			const dep_disknode = new Disknode('/test/dep.js', {} as Disknode_Api);
			const mock_api: Disknode_Api = {
				map_alias: vi.fn((spec) => spec),
				resolve_specifier: vi.fn(() => ({path_id: '/test/dep.js'})),
				resolve_external_specifier: vi.fn(),
				get_disknode: vi.fn().mockReturnValue(dep_disknode),
			};

			const mock_stats = create_mock_stats();
			vi.mocked(lstatSync).mockReturnValue(mock_stats as any);
			vi.mocked(readFileSync).mockReturnValue('import {dep} from "./dep.js";');

			const disknode = new Disknode(TEST_PATH_TS, mock_api);

			// Access imports to create dependency
			disknode.imports;

			// Verify bidirectional relationship
			expect(disknode.dependencies.has('/test/dep.js')).toBe(true);
			expect(disknode.dependencies.get('/test/dep.js')).toBe(dep_disknode);
			expect(dep_disknode.dependents.has(TEST_PATH_TS)).toBe(true);
			expect(dep_disknode.dependents.get(TEST_PATH_TS)).toBe(disknode);
		});
	});

	describe('api interface contract', () => {
		test('api property is accessible and readonly', () => {
			const mock_api: Disknode_Api = {
				map_alias: vi.fn(),
				resolve_specifier: vi.fn(),
				resolve_external_specifier: vi.fn(),
				get_disknode: vi.fn(),
			};

			const disknode = new Disknode(TEST_PATH_TS, mock_api);
			expect(disknode.api).toBe(mock_api);

			// TypeScript readonly is compile-time only, no runtime enforcement
			// Just verify the property exists and is the expected value
			expect(disknode.api).toBe(mock_api);
		});

		test('constructor requires valid Disknode_Api implementation', () => {
			const incomplete_api = {
				map_alias: vi.fn(),
				// Missing other required methods
			} as any;

			// TypeScript should catch this, but test runtime behavior
			const disknode = new Disknode(TEST_PATH_TS, incomplete_api);
			expect(disknode.api).toBe(incomplete_api);
		});
	});

	describe('edge cases and error handling', () => {
		test('handles empty import content', () => {
			const mock_api: Disknode_Api = {
				map_alias: vi.fn((spec) => spec),
				resolve_specifier: vi.fn(),
				resolve_external_specifier: vi.fn(),
				get_disknode: vi.fn(),
			};

			const mock_stats = create_mock_stats();
			vi.mocked(lstatSync).mockReturnValue(mock_stats as any);
			vi.mocked(readFileSync).mockReturnValue(''); // Empty content

			const disknode = new Disknode(TEST_PATH_TS, mock_api);

			// Empty content returns null because contents is empty string
			const imports = disknode.imports;
			expect(imports).toBe(null);
			
			// No api methods should be called for empty content
			expect(mock_api.resolve_specifier).not.toHaveBeenCalled();
			expect(mock_api.resolve_external_specifier).not.toHaveBeenCalled();
		});

		test('handles whitespace-only import content', () => {
			const mock_api: Disknode_Api = {
				map_alias: vi.fn((spec) => spec),
				resolve_specifier: vi.fn(),
				resolve_external_specifier: vi.fn(),
				get_disknode: vi.fn(),
			};

			const mock_stats = create_mock_stats();
			vi.mocked(lstatSync).mockReturnValue(mock_stats as any);
			vi.mocked(readFileSync).mockReturnValue('   \n  \t  \n   '); // Whitespace only

			const disknode = new Disknode(TEST_PATH_TS, mock_api);
			
			const imports = disknode.imports;
			expect(imports).toEqual(new Set());
		});

		test('handles mixed import types with failures', () => {
			const successful_dep = new Disknode('/test/success.js', {} as Disknode_Api);
			const mock_api: Disknode_Api = {
				map_alias: vi.fn((spec) => spec),
				resolve_specifier: vi.fn(() => ({path_id: '/test/success.js'})),
				resolve_external_specifier: vi.fn().mockImplementation((spec) => {
					if (spec === 'failing-package') throw new Error('Not found');
					return 'file:///resolved/' + spec;
				}),
				get_disknode: vi.fn().mockReturnValue(successful_dep),
			};

			const mock_stats = create_mock_stats();
			vi.mocked(lstatSync).mockReturnValue(mock_stats as any);
			vi.mocked(readFileSync).mockReturnValue(`
				import {local} from "./success.js";
				import {good} from "good-package";
				import {bad} from "failing-package";
			`);

			const disknode = new Disknode(TEST_PATH_TS, mock_api);
			
			// Should handle mixed success/failure gracefully
			const imports = disknode.imports;
			expect(imports?.has('./success.js')).toBe(true);
			expect(imports?.has('good-package')).toBe(true);
			expect(imports?.has('failing-package')).toBe(true);

			// Should only create dependency for successful resolutions
			expect(disknode.dependencies.size).toBe(1);
			expect(disknode.dependencies.has('/test/success.js')).toBe(true);
		});

		test('handles complex alias patterns', () => {
			const mock_api: Disknode_Api = {
				map_alias: vi.fn().mockImplementation((spec) => {
					if (spec.startsWith('@/')) return '/src' + spec.slice(1);
					if (spec.startsWith('~/')) return '/home/user' + spec.slice(1);
					if (spec === '@config') return '/config/index.js';
					return spec;
				}),
				resolve_specifier: vi.fn(() => ({path_id: '/mapped/path.js'})),
				resolve_external_specifier: vi.fn(),
				get_disknode: vi.fn((id) => new Disknode(id, mock_api)),
			};

			const mock_stats = create_mock_stats();
			vi.mocked(lstatSync).mockReturnValue(mock_stats as any);
			vi.mocked(readFileSync).mockReturnValue(`
				import {component} from "@/components/Button.svelte";
				import {config} from "~/config/app.js";
				import {settings} from "@config";
			`);

			const disknode = new Disknode(TEST_PATH_TS, mock_api);
			disknode.imports;

			// Verify alias mapping was called for each import
			expect(mock_api.map_alias).toHaveBeenCalledWith('@/components/Button.svelte');
			expect(mock_api.map_alias).toHaveBeenCalledWith('~/config/app.js');
			expect(mock_api.map_alias).toHaveBeenCalledWith('@config');
		});

		test('handles dependency relationship updates correctly', () => {
			const dep1 = new Disknode('/test/dep1.js', {} as Disknode_Api);
			const dep2 = new Disknode('/test/dep2.js', {} as Disknode_Api);
			const dep3 = new Disknode('/test/dep3.js', {} as Disknode_Api);

			const mock_api: Disknode_Api = {
				map_alias: vi.fn((spec) => spec),
				resolve_specifier: vi.fn().mockImplementation((spec) => {
					if (spec === './dep1.js') return {path_id: '/test/dep1.js'};
					if (spec === './dep2.js') return {path_id: '/test/dep2.js'};
					if (spec === './dep3.js') return {path_id: '/test/dep3.js'};
					return {path_id: '/unknown.js'};
				}),
				resolve_external_specifier: vi.fn(),
				get_disknode: vi.fn().mockImplementation((id) => {
					if (id === '/test/dep1.js') return dep1;
					if (id === '/test/dep2.js') return dep2;
					if (id === '/test/dep3.js') return dep3;
					return new Disknode(id, mock_api);
				}),
			};

			const mock_stats = create_mock_stats();
			vi.mocked(lstatSync).mockReturnValue(mock_stats as any);

			// Start with dep1 and dep2
			vi.mocked(readFileSync).mockReturnValueOnce(`
				import {a} from "./dep1.js";
				import {b} from "./dep2.js";
			`);

			const disknode = new Disknode(TEST_PATH_TS, mock_api);
			disknode.imports; // First access

			expect(disknode.dependencies.size).toBe(2);
			expect(dep1.dependents.has(TEST_PATH_TS)).toBe(true);
			expect(dep2.dependents.has(TEST_PATH_TS)).toBe(true);

			// Update to dep2 and dep3 (remove dep1, add dep3)
			vi.mocked(readFileSync).mockReturnValueOnce(`
				import {b} from "./dep2.js";
				import {c} from "./dep3.js";
			`);

			disknode.invalidate();
			disknode.imports; // Second access

			expect(disknode.dependencies.size).toBe(2);
			expect(dep1.dependents.has(TEST_PATH_TS)).toBe(false); // Removed
			expect(dep2.dependents.has(TEST_PATH_TS)).toBe(true);  // Kept
			expect(dep3.dependents.has(TEST_PATH_TS)).toBe(true);  // Added
		});

		test('handles circular dependency scenarios', () => {
			let disknode_a: Disknode;
			let disknode_b: Disknode;

			const mock_api: Disknode_Api = {
				map_alias: vi.fn((spec) => spec),
				resolve_specifier: vi.fn().mockImplementation((spec) => {
					if (spec === './b.js') return {path_id: '/test/b.js'};
					if (spec === './a.js') return {path_id: '/test/a.js'};
					return {path_id: '/unknown.js'};
				}),
				resolve_external_specifier: vi.fn(),
				get_disknode: vi.fn().mockImplementation((id) => {
					if (id === '/test/a.js') return disknode_a;
					if (id === '/test/b.js') return disknode_b;
					return new Disknode(id, mock_api);
				}),
			};

			disknode_a = new Disknode('/test/a.js', mock_api);
			disknode_b = new Disknode('/test/b.js', mock_api);

			const mock_stats = create_mock_stats();
			vi.mocked(lstatSync).mockReturnValue(mock_stats as any);
			
			// A imports B
			vi.mocked(readFileSync).mockReturnValueOnce('import {b} from "./b.js";');
			
			// B imports A (circular)
			vi.mocked(readFileSync).mockReturnValueOnce('import {a} from "./a.js";');

			// Should handle circular dependencies gracefully
			disknode_a.imports;
			disknode_b.imports;

			expect(disknode_a.dependencies.has('/test/b.js')).toBe(true);
			expect(disknode_b.dependencies.has('/test/a.js')).toBe(true);
			expect(disknode_a.dependents.has('/test/b.js')).toBe(true);
			expect(disknode_b.dependents.has('/test/a.js')).toBe(true);
		});
	});
});
