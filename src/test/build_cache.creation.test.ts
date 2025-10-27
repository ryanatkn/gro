import {describe, test, expect, vi, beforeEach} from 'vitest';

import {create_build_cache_metadata} from '../lib/build_cache.ts';

import {create_mock_logger, create_mock_config} from './build_cache_test_helpers.ts';

// Mock dependencies
vi.mock('@ryanatkn/belt/git.js', () => ({
	git_current_commit_hash: vi.fn(),
}));

vi.mock('node:fs', () => ({
	existsSync: vi.fn(),
	readFileSync: vi.fn(),
	writeFileSync: vi.fn(),
	mkdirSync: vi.fn(),
	rmSync: vi.fn(),
	statSync: vi.fn(),
	readdirSync: vi.fn(),
}));

vi.mock('$lib/hash.js', () => ({
	to_hash: vi.fn(),
}));

describe('create_build_cache_metadata', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('creates complete metadata object', async () => {
		const {git_current_commit_hash} = await import('@ryanatkn/belt/git.js');
		const {existsSync, readdirSync, statSync} = await import('node:fs');
		const {to_hash} = await import('$lib/hash.js');

		vi.mocked(git_current_commit_hash).mockResolvedValue('abc123');
		vi.mocked(existsSync).mockReturnValue(false);
		vi.mocked(readdirSync).mockReturnValue([]);
		vi.mocked(statSync).mockReturnValue({isDirectory: () => false} as any);
		vi.mocked(to_hash).mockResolvedValue('hash123');

		const config = create_mock_config();
		const log = create_mock_logger();

		const result = await create_build_cache_metadata(config, log);

		expect(result).toMatchObject({
			version: '1',
			git_commit: 'abc123',
		});
		expect(result.timestamp).toBeTruthy();
		expect(new Date(result.timestamp).getTime()).toBeGreaterThan(0);
	});

	test('creates metadata with actual build outputs', async () => {
		const {git_current_commit_hash} = await import('@ryanatkn/belt/git.js');
		const {existsSync, readdirSync, readFileSync, statSync} = await import('node:fs');
		const {to_hash} = await import('$lib/hash.js');

		vi.mocked(git_current_commit_hash).mockResolvedValue('abc123');
		vi.mocked(existsSync).mockImplementation((path: any) => path === 'build');
		vi.mocked(readdirSync).mockImplementation((path: any) => {
			if (path === 'build') {
				return [
					{name: 'index.html', isDirectory: () => false, isFile: () => true},
					{name: 'bundle.js', isDirectory: () => false, isFile: () => true},
				] as any;
			}
			return [] as any;
		});
		vi.mocked(statSync).mockImplementation((path: any) => {
			if (String(path) === 'build') return {isDirectory: () => true} as any;
			return {
				size: 1024,
				mtimeMs: 1729512000000,
				ctimeMs: 1729512000000,
				mode: 33188,
				isDirectory: () => false,
			} as any;
		});
		vi.mocked(readFileSync).mockReturnValue(Buffer.from('content'));

		let hash_count = 0;
		// eslint-disable-next-line @typescript-eslint/require-await
		vi.mocked(to_hash).mockImplementation(async () => `hash${++hash_count}`);

		const config = create_mock_config();
		const log = create_mock_logger();

		const result = await create_build_cache_metadata(config, log);

		expect(result.outputs).toHaveLength(2);
		expect(result.outputs[0]).toMatchObject({
			path: 'build/index.html',
			hash: 'hash2', // hash1 is for config hash
			size: 1024,
		});
		expect(result.outputs[1]).toMatchObject({
			path: 'build/bundle.js',
			hash: 'hash3',
			size: 1024,
		});
	});

	test('creates metadata with multiple build directories', async () => {
		const {git_current_commit_hash} = await import('@ryanatkn/belt/git.js');
		const {existsSync, readdirSync, readFileSync, statSync} = await import('node:fs');
		const {to_hash} = await import('$lib/hash.js');

		vi.mocked(git_current_commit_hash).mockResolvedValue('abc123');

		// Mock all three directories exist
		vi.mocked(existsSync).mockReturnValue(true);

		// Mock root directory listing for dist_ discovery
		vi.mocked(readdirSync).mockImplementation((path: any) => {
			if (path === '.') {
				return ['dist_server', 'src', 'node_modules'] as any;
			}
			if (path === 'build') {
				return [{name: 'app.js', isDirectory: () => false, isFile: () => true}] as any;
			}
			if (path === 'dist') {
				return [{name: 'lib.js', isDirectory: () => false, isFile: () => true}] as any;
			}
			if (path === 'dist_server') {
				return [{name: 'server.js', isDirectory: () => false, isFile: () => true}] as any;
			}
			return [] as any;
		});

		vi.mocked(statSync).mockReturnValue({
			size: 512,
			mtimeMs: 1729512000000,
			ctimeMs: 1729512000000,
			mode: 33188,
			isDirectory: () => true,
		} as any);
		vi.mocked(readFileSync).mockReturnValue(Buffer.from('content'));

		let hash_count = 0;
		// eslint-disable-next-line @typescript-eslint/require-await
		vi.mocked(to_hash).mockImplementation(async () => `hash${++hash_count}`);

		const config = create_mock_config();
		const log = create_mock_logger();

		const result = await create_build_cache_metadata(config, log);

		// Should have files from all three directories
		expect(result.outputs).toHaveLength(3);
		expect(result.outputs.find((o) => o.path === 'build/app.js')).toBeDefined();
		expect(result.outputs.find((o) => o.path === 'dist/lib.js')).toBeDefined();
		expect(result.outputs.find((o) => o.path === 'dist_server/server.js')).toBeDefined();
	});

	test('handles empty build directories', async () => {
		const {git_current_commit_hash} = await import('@ryanatkn/belt/git.js');
		const {existsSync, readdirSync, statSync} = await import('node:fs');
		const {to_hash} = await import('$lib/hash.js');

		vi.mocked(git_current_commit_hash).mockResolvedValue('abc123');
		vi.mocked(existsSync).mockImplementation((path: any) => path === 'build');
		vi.mocked(readdirSync).mockImplementation((path: any) => {
			if (path === 'build') return [] as any; // Empty directory
			return [] as any;
		});
		vi.mocked(statSync).mockReturnValue({isDirectory: () => true} as any);
		vi.mocked(to_hash).mockResolvedValue('hash123');

		const config = create_mock_config();
		const log = create_mock_logger();

		const result = await create_build_cache_metadata(config, log);

		// Should succeed with empty outputs
		expect(result.outputs).toEqual([]);
		expect(result.git_commit).toBe('abc123');
	});

	test('creates metadata with deeply nested file structures', async () => {
		const {git_current_commit_hash} = await import('@ryanatkn/belt/git.js');
		const {existsSync, readdirSync, readFileSync, statSync} = await import('node:fs');
		const {to_hash} = await import('$lib/hash.js');

		vi.mocked(git_current_commit_hash).mockResolvedValue('abc123');
		vi.mocked(existsSync).mockImplementation((path: any) => path === 'build');

		// Mock nested: build/assets/js/lib/utils/
		vi.mocked(readdirSync).mockImplementation((path: any) => {
			const path_str = String(path);
			if (path_str === 'build') {
				return [{name: 'assets', isDirectory: () => true, isFile: () => false}] as any;
			}
			if (path_str === 'build/assets') {
				return [{name: 'js', isDirectory: () => true, isFile: () => false}] as any;
			}
			if (path_str === 'build/assets/js') {
				return [{name: 'lib', isDirectory: () => true, isFile: () => false}] as any;
			}
			if (path_str === 'build/assets/js/lib') {
				return [{name: 'utils', isDirectory: () => true, isFile: () => false}] as any;
			}
			if (path_str === 'build/assets/js/lib/utils') {
				return [{name: 'helper.js', isDirectory: () => false, isFile: () => true}] as any;
			}
			return [] as any;
		});

		vi.mocked(statSync).mockImplementation((path: any) => {
			if (String(path).endsWith('.js')) {
				return {
					size: 256,
					mtimeMs: 1729512000000,
					ctimeMs: 1729512000000,
					mode: 33188,
					isDirectory: () => false,
				} as any;
			}
			return {isDirectory: () => true} as any;
		});
		vi.mocked(readFileSync).mockReturnValue(Buffer.from('content'));
		vi.mocked(to_hash).mockResolvedValue('deep_hash');

		const config = create_mock_config();
		const log = create_mock_logger();

		const result = await create_build_cache_metadata(config, log);

		// Should find the deeply nested file
		expect(result.outputs).toHaveLength(1);
		expect(result.outputs[0].path).toBe('build/assets/js/lib/utils/helper.js');
		expect(result.outputs[0].size).toBe(256);
	});

	test('handles build directories with many files', async () => {
		const {git_current_commit_hash} = await import('@ryanatkn/belt/git.js');
		const {existsSync, readdirSync, readFileSync, statSync} = await import('node:fs');
		const {to_hash} = await import('$lib/hash.js');

		vi.mocked(git_current_commit_hash).mockResolvedValue('abc123');
		vi.mocked(existsSync).mockImplementation((path: any) => path === 'build');

		// Create 15 files
		const files = Array.from({length: 15}, (_, i) => ({
			name: `file${i}.js`,
			isDirectory: () => false,
			isFile: () => true,
		}));

		vi.mocked(readdirSync).mockImplementation((path: any) => {
			if (path === 'build') return files as any;
			return [] as any;
		});

		vi.mocked(statSync).mockReturnValue({
			size: 2048,
			mtimeMs: 1729512000000,
			ctimeMs: 1729512000000,
			mode: 33188,
			isDirectory: () => false,
		} as any);
		vi.mocked(readFileSync).mockReturnValue(Buffer.from('content'));

		let hash_count = 0;
		// eslint-disable-next-line @typescript-eslint/require-await
		vi.mocked(to_hash).mockImplementation(async () => `hash${++hash_count}`);

		const config = create_mock_config();
		const log = create_mock_logger();

		const result = await create_build_cache_metadata(config, log);

		// Should hash all 15 files in parallel
		expect(result.outputs).toHaveLength(15);
		// Verify all files are present
		for (let i = 0; i < 15; i++) {
			expect(result.outputs.find((o) => o.path === `build/file${i}.js`)).toBeDefined();
		}
	});

	test('creates metadata with null git commit', async () => {
		const {git_current_commit_hash} = await import('@ryanatkn/belt/git.js');
		const {existsSync, readdirSync, statSync} = await import('node:fs');
		const {to_hash} = await import('$lib/hash.js');

		// Non-git repository
		vi.mocked(git_current_commit_hash).mockResolvedValue(null);
		vi.mocked(existsSync).mockReturnValue(false);
		vi.mocked(readdirSync).mockReturnValue([]);
		vi.mocked(statSync).mockReturnValue({isDirectory: () => false} as any);
		vi.mocked(to_hash).mockResolvedValue('hash123');

		const config = create_mock_config();
		const log = create_mock_logger();

		const result = await create_build_cache_metadata(config, log);

		// Should have null git commit
		expect(result.git_commit).toBeNull();
		expect(result.version).toBe('1');
		expect(result.timestamp).toBeTruthy();
		expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('Not in a git repository'));
	});

	test('includes correct build_cache_config_hash', async () => {
		const {git_current_commit_hash} = await import('@ryanatkn/belt/git.js');
		const {existsSync, readdirSync, statSync} = await import('node:fs');
		const {to_hash} = await import('$lib/hash.js');

		vi.mocked(git_current_commit_hash).mockResolvedValue('abc123');
		vi.mocked(existsSync).mockReturnValue(false);
		vi.mocked(readdirSync).mockReturnValue([]);
		vi.mocked(statSync).mockReturnValue({isDirectory: () => false} as any);

		// First call is for build_cache_config hash
		vi.mocked(to_hash).mockResolvedValue('custom_config_hash');

		const config = create_mock_config({
			build_cache_config: {
				api_endpoint: 'https://api.example.com',
				feature_flags: {experimental: true},
			},
		});
		const log = create_mock_logger();

		const result = await create_build_cache_metadata(config, log);

		// Should include the hashed config
		expect(result.build_cache_config_hash).toBe('custom_config_hash');
		expect(result.git_commit).toBe('abc123');
	});
});
