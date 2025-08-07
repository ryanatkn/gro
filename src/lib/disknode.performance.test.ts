// @slop Claude Sonnet 4

import {test, expect, describe, vi} from 'vitest';

import {Disknode} from './disknode.ts';

const mockLstat = vi.hoisted(() => vi.fn());
const mockReadFile = vi.hoisted(() => vi.fn());

vi.mock('node:fs/promises', () => ({
	readFile: mockReadFile,
	lstat: mockLstat,
	realpath: vi.fn(),
}));

// Also mock the sync version for any remaining usage
vi.mock('node:fs', () => ({
	existsSync: vi.fn(),
}));

describe('Disknode Performance Optimizations', () => {
	const create_mock_filer = () =>
		({
			disknodes: new Map(),
			map_alias: (alias: string) => alias,
			get_disknode: (id: string) => new Disknode(id, create_mock_filer()),
			parse_imports_async: vi.fn().mockResolvedValue([]),
			load_resources_batch: vi.fn().mockResolvedValue(undefined),
		}) as any;

	describe('explicit loading performance characteristics', () => {
		test('load_imports skips loading for non-importable files', async () => {
			const filer = create_mock_filer();
			const node = new Disknode('/path/to/config.json', filer);

			// Spy on parse_imports_async to ensure it's not called
			const parse_imports_spy = vi.spyOn(filer, 'parse_imports_async');

			// Load imports for non-importable file
			await node.load_imports();

			expect(node.imports).toBeNull();
			expect(parse_imports_spy).not.toHaveBeenCalled();
		});

		test('load_imports calls parse_imports_async for importable files', async () => {
			const filer = create_mock_filer();
			const node = new Disknode('/path/to/utils.ts', filer);

			// Mock file content
			mockLstat.mockResolvedValue({
				size: 100,
				isDirectory: () => false,
				isSymbolicLink: () => false,
			} as any);
			mockReadFile.mockResolvedValue('export const foo = 1;');

			// Spy on parse_imports_async
			const parse_imports_spy = vi.spyOn(filer, 'parse_imports_async');
			parse_imports_spy.mockResolvedValue(['./helper.js']);

			await node.load_imports();

			expect(parse_imports_spy).toHaveBeenCalledWith('/path/to/utils.ts', 'export const foo = 1;');
			expect(node.imports?.has('./helper.js')).toBe(true);
		});

		test('caches imports after loading', async () => {
			const filer = create_mock_filer();
			const node = new Disknode('/path/to/utils.ts', filer);

			// Mock file content
			mockLstat.mockResolvedValue({
				size: 100,
				isDirectory: () => false,
				isSymbolicLink: () => false,
			} as any);
			mockReadFile.mockResolvedValue('export const foo = 1;');

			// Spy on parse_imports_async
			const parse_imports_spy = vi.spyOn(filer, 'parse_imports_async');
			parse_imports_spy.mockResolvedValue(['./helper.js']);

			// Load imports multiple times
			await node.load_imports();
			await node.load_imports();
			await node.load_imports();

			// Should only call parse_imports_async once due to caching
			expect(parse_imports_spy).toHaveBeenCalledTimes(1);
		});
	});

	describe('stats loading optimization', () => {
		test('load_stats caches results', async () => {
			const filer = create_mock_filer();
			const node = new Disknode('/path/to/file.ts', filer);

			// Clear any previous calls and set up mock return value
			mockLstat.mockClear();
			mockLstat.mockResolvedValue({
				size: 1024,
				mtimeMs: Date.now(),
				isDirectory: () => false,
				isSymbolicLink: () => false,
			} as any);

			// Load stats multiple times
			await node.load_stats();
			const size1 = node.size;
			const size2 = node.size;
			const size3 = node.size;

			expect(size1).toBe(1024);
			expect(size2).toBe(1024);
			expect(size3).toBe(1024);
			// lstat should only be called once due to caching
			expect(mockLstat).toHaveBeenCalledTimes(1);
		});

		test('reloads stats after invalidation', async () => {
			const filer = create_mock_filer();
			const node = new Disknode('/path/to/file.ts', filer);

			// Clear any previous calls
			mockLstat.mockClear();
			let call_count = 0;
			mockLstat.mockImplementation(async () => {
				call_count++;
				// Return different stats on different calls to simulate file change
				return {
					size: call_count === 1 ? 512 : 1024,
					mtimeMs: Date.now() + call_count * 1000,
					isDirectory: () => false,
					isSymbolicLink: () => false,
				} as any;
			});

			// First load
			await node.load_stats();
			const size1 = node.size;
			// Invalidate to force new stats load
			node.invalidate();
			// Second load should get fresh stats
			await node.load_stats();
			const size2 = node.size;

			expect(size1).toBe(512);
			expect(size2).toBe(1024);
			// Should call lstat twice due to invalidation
			expect(mockLstat).toHaveBeenCalledTimes(2);
		});

		test('handles null stats gracefully', async () => {
			const filer = create_mock_filer();
			const node = new Disknode('/path/to/nonexistent.ts', filer);

			// Mock lstat to throw (file doesn't exist)
			mockLstat.mockImplementation(async () => {
				throw new Error('ENOENT');
			});

			await node.load_stats();
			const size = node.size;

			expect(size).toBeNull();
		});
	});

	describe('contents loading optimization', () => {
		test('load_contents caches small files', async () => {
			const filer = create_mock_filer();
			const node = new Disknode('/path/to/file.ts', filer);

			// Clear any previous calls and set up mock return value
			mockReadFile.mockClear();
			mockReadFile.mockResolvedValue('export const foo = 1;');

			// Mock lstat to return file stats
			mockLstat.mockClear();
			mockLstat.mockResolvedValue({
				size: 1024, // Small file, should be cached
				mtimeMs: Date.now(),
				isDirectory: () => false,
				isSymbolicLink: () => false,
			} as any);

			// Load contents once, then access multiple times
			await node.load_contents();
			const content1 = node.contents;
			const content2 = node.contents;
			const content3 = node.contents;

			expect(content1).toBe('export const foo = 1;');
			expect(content2).toBe('export const foo = 1;');
			expect(content3).toBe('export const foo = 1;');
			// readFile should only be called once due to caching
			expect(mockReadFile).toHaveBeenCalledTimes(1);
		});
	});

	describe('getters return undefined when not loaded', () => {
		test('getters return undefined before explicit loading', () => {
			const filer = create_mock_filer();
			const node = new Disknode('/path/to/file.ts', filer);

			// All getters should return undefined until explicitly loaded
			expect(node.stats).toBeUndefined();
			expect(node.contents).toBeUndefined();
			expect(node.imports).toBeUndefined();
			expect(node.size).toBeUndefined();
		});

		test('getters return data after explicit loading', async () => {
			const filer = create_mock_filer();
			const node = new Disknode('/path/to/file.ts', filer);

			// Mock filesystem
			mockLstat.mockResolvedValue({
				size: 100,
				isDirectory: () => false,
				isSymbolicLink: () => false,
			} as any);
			mockReadFile.mockResolvedValue('export const foo = 1;');
			vi.spyOn(filer, 'parse_imports_async').mockResolvedValue(['./helper.js']);

			// Load resources explicitly
			await node.load_stats();
			await node.load_contents();
			await node.load_imports();

			// Now getters should return data
			expect(node.stats).not.toBeNull();
			expect(node.contents).toBe('export const foo = 1;');
			expect(node.imports?.has('./helper.js')).toBe(true);
			expect(node.size).toBe(100);
		});
	});
});
