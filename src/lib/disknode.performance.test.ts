// @slop Claude Sonnet 4

import {test, expect, describe, vi} from 'vitest';

import {Disknode} from './disknode.ts';

const mockLstatSync = vi.hoisted(() => vi.fn());
const mockReadFileSync = vi.hoisted(() => vi.fn());
vi.mock('node:fs', () => ({
	existsSync: vi.fn(),
	readFileSync: mockReadFileSync,
	lstatSync: mockLstatSync,
	realpathSync: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
	stat: vi.fn(),
}));

describe('Disknode Performance Optimizations', () => {
	const create_mock_filer = () =>
		({
			disknodes: new Map(),
			map_alias: (alias: string) => alias,
			get_disknode: (id: string) => new Disknode(id, create_mock_filer()),
		}) as any;

	describe('imports getter early return optimization', () => {
		test('avoids contents access for non-importable files', () => {
			const filer = create_mock_filer();
			const node = new Disknode('/path/to/config.json', filer);

			// Mock is_importable to return false
			const is_importable_spy = vi.fn(() => false);
			Object.defineProperty(node, 'is_importable', {
				get: is_importable_spy,
				configurable: true,
			});

			// Mock contents to track access
			const contents_spy = vi.fn(() => 'some content');
			Object.defineProperty(node, 'contents', {
				get: contents_spy,
				configurable: true,
			});

			// Access imports - should return null without accessing contents
			const imports = node.imports;

			expect(imports).toBeNull();
			expect(contents_spy).not.toHaveBeenCalled();
			expect(is_importable_spy).toHaveBeenCalledTimes(1);
		});

		test('accesses contents only for importable files', () => {
			const filer = create_mock_filer();
			const node = new Disknode('/path/to/utils.ts', filer);

			// Mock is_importable to return true
			const is_importable_spy = vi.fn(() => true);
			Object.defineProperty(node, 'is_importable', {
				get: is_importable_spy,
				configurable: true,
			});

			// Mock contents to track access
			const contents_spy = vi.fn(() => 'export const foo = 1;');
			Object.defineProperty(node, 'contents', {
				get: contents_spy,
				configurable: true,
			});

			// Access imports - should access contents since file is importable
			node.imports;

			expect(is_importable_spy).toHaveBeenCalledTimes(1);
			expect(contents_spy).toHaveBeenCalledTimes(1);
		});

		test('caches importable check result across calls', () => {
			const filer = create_mock_filer();
			const node = new Disknode('/path/to/utils.ts', filer);

			const is_importable_spy = vi.fn(() => false);
			Object.defineProperty(node, 'is_importable', {
				get: is_importable_spy,
				configurable: true,
			});

			// Access imports multiple times
			node.imports;
			node.imports;
			node.imports;

			// Should only check is_importable once due to version caching
			expect(is_importable_spy).toHaveBeenCalledTimes(1);
		});
	});

	describe('size getter optimization', () => {
		test('uses cached stats when version matches', () => {
			const filer = create_mock_filer();
			const node = new Disknode('/path/to/file.ts', filer);

			// Clear any previous calls and set up mock return value
			mockLstatSync.mockClear();
			mockLstatSync.mockReturnValue({
				size: 1024,
				mtimeMs: Date.now(),
				isDirectory: () => false,
				isSymbolicLink: () => false,
			} as any);

			// Multiple size accesses should use cached stats
			const size1 = node.size;
			const size2 = node.size;
			const size3 = node.size;

			expect(size1).toBe(1024);
			expect(size2).toBe(1024);
			expect(size3).toBe(1024);
			// lstatSync should only be called once due to caching
			expect(mockLstatSync).toHaveBeenCalledTimes(1);
		});

		test('lazy loads stats when version does not match', () => {
			const filer = create_mock_filer();
			const node = new Disknode('/path/to/file.ts', filer);

			// Clear any previous calls
			mockLstatSync.mockClear();
			let call_count = 0;
			mockLstatSync.mockImplementation(() => {
				call_count++;
				// Return different stats on different calls to simulate file change
				return {
					size: call_count === 1 ? 512 : 1024,
					mtimeMs: Date.now() + call_count * 1000,
					isDirectory: () => false,
					isSymbolicLink: () => false,
				} as any;
			});

			// First access
			const size1 = node.size;
			// Invalidate to force new stats load
			node.invalidate();
			// Second access should load fresh stats
			const size2 = node.size;

			expect(size1).toBe(512);
			expect(size2).toBe(1024);
			// Should call lstatSync twice due to invalidation
			expect(mockLstatSync).toHaveBeenCalledTimes(2);
		});

		test('handles null stats gracefully', () => {
			const filer = create_mock_filer();
			const node = new Disknode('/path/to/nonexistent.ts', filer);

			// Mock stats to return null
			Object.defineProperty(node, 'stats', {
				get: vi.fn(() => null),
				configurable: true,
			});

			const size = node.size;

			expect(size).toBeNull();
		});
	});

	describe('performance regression tests', () => {
		test('contents getter uses caching to avoid redundant file reads', () => {
			const filer = create_mock_filer();
			const node = new Disknode('/path/to/file.ts', filer);

			// Clear any previous calls and set up mock return value
			mockReadFileSync.mockClear();
			mockReadFileSync.mockReturnValue('export const foo = 1;');

			// Mock lstatSync to return file stats
			mockLstatSync.mockClear();
			mockLstatSync.mockReturnValue({
				size: 1024, // Small file, should be cached
				mtimeMs: Date.now(),
				isDirectory: () => false,
				isSymbolicLink: () => false,
			} as any);

			// Multiple contents accesses should use cached value
			const content1 = node.contents;
			const content2 = node.contents;
			const content3 = node.contents;

			expect(content1).toBe('export const foo = 1;');
			expect(content2).toBe('export const foo = 1;');
			expect(content3).toBe('export const foo = 1;');
			// readFileSync should only be called once due to caching
			expect(mockReadFileSync).toHaveBeenCalledTimes(1);
		});
	});
});