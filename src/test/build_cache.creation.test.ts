import {describe, test, expect, vi, beforeEach} from 'vitest';

import {create_build_cache_metadata} from '../lib/build_cache.ts';

import {
	create_mock_logger,
	create_mock_config,
	mock_file_stats,
	mock_dir_stats,
	mock_file_entry,
	mock_dir_entry,
} from './build_cache_test_helpers.ts';

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
		vi.mocked(readdirSync).mockReturnValue([] as any);
		vi.mocked(statSync).mockReturnValue(mock_dir_stats());
		vi.mocked(to_hash).mockResolvedValue('hash123');

		const config = await create_mock_config();
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
			if (path === '.') return [] as any;
			if (path === 'build') {
				return [mock_file_entry('index.html'), mock_file_entry('bundle.js')] as any;
			}
			return [] as any;
		});
		vi.mocked(statSync).mockImplementation((path: any) => {
			if (String(path) === 'build') return mock_dir_stats();
			return mock_file_stats();
		});
		vi.mocked(readFileSync).mockReturnValue(Buffer.from('content'));

		let hash_count = 0;
		// eslint-disable-next-line @typescript-eslint/require-await
		vi.mocked(to_hash).mockImplementation(async () => `hash${++hash_count}`);

		const config = await create_mock_config();
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

		vi.mocked(existsSync).mockReturnValue(true);

		vi.mocked(readdirSync).mockImplementation((path: any) => {
			if (path === '.') {
				return ['dist_server', 'src', 'node_modules'] as any;
			}
			if (path === 'build') {
				return [mock_file_entry('app.js')] as any;
			}
			if (path === 'dist') {
				return [mock_file_entry('lib.js')] as any;
			}
			if (path === 'dist_server') {
				return [mock_file_entry('server.js')] as any;
			}
			return [] as any;
		});

		vi.mocked(statSync).mockReturnValue(mock_dir_stats());
		vi.mocked(readFileSync).mockReturnValue(Buffer.from('content'));

		let hash_count = 0;
		// eslint-disable-next-line @typescript-eslint/require-await
		vi.mocked(to_hash).mockImplementation(async () => `hash${++hash_count}`);

		const config = await create_mock_config();
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
			if (path === '.') return [] as any;
			if (path === 'build') return [] as any;
			return [] as any;
		});
		vi.mocked(statSync).mockReturnValue(mock_dir_stats());
		vi.mocked(to_hash).mockResolvedValue('hash123');

		const config = await create_mock_config();
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

		vi.mocked(readdirSync).mockImplementation((path: any) => {
			const path_str = String(path);
			if (path_str === '.') return [] as any;
			if (path_str === 'build') {
				return [mock_dir_entry('assets')] as any;
			}
			if (path_str === 'build/assets') {
				return [mock_dir_entry('js')] as any;
			}
			if (path_str === 'build/assets/js') {
				return [mock_dir_entry('lib')] as any;
			}
			if (path_str === 'build/assets/js/lib') {
				return [mock_dir_entry('utils')] as any;
			}
			if (path_str === 'build/assets/js/lib/utils') {
				return [mock_file_entry('helper.js')] as any;
			}
			return [] as any;
		});

		vi.mocked(statSync).mockImplementation((path: any) => {
			if (String(path).endsWith('.js')) {
				return mock_file_stats(256);
			}
			return mock_dir_stats();
		});
		vi.mocked(readFileSync).mockReturnValue(Buffer.from('content'));
		vi.mocked(to_hash).mockResolvedValue('deep_hash');

		const config = await create_mock_config();
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

		const files = Array.from({length: 15}, (_, i) => mock_file_entry(`file${i}.js`));

		vi.mocked(readdirSync).mockImplementation((path: any) => {
			if (path === '.') return [] as any;
			if (path === 'build') return files as any;
			return [] as any;
		});

		vi.mocked(statSync).mockReturnValue(mock_file_stats(2048));
		vi.mocked(readFileSync).mockReturnValue(Buffer.from('content'));

		let hash_count = 0;
		// eslint-disable-next-line @typescript-eslint/require-await
		vi.mocked(to_hash).mockImplementation(async () => `hash${++hash_count}`);

		const config = await create_mock_config();
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

		vi.mocked(git_current_commit_hash).mockResolvedValue(null);
		vi.mocked(existsSync).mockReturnValue(false);
		vi.mocked(readdirSync).mockReturnValue([] as any);
		vi.mocked(statSync).mockReturnValue(mock_dir_stats());
		vi.mocked(to_hash).mockResolvedValue('hash123');

		const config = await create_mock_config();
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
		vi.mocked(statSync).mockReturnValue(mock_dir_stats());
		vi.mocked(to_hash).mockResolvedValue('custom_config_hash');

		const config = await create_mock_config({
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
