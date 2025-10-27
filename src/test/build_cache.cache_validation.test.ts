import {describe, test, expect, vi, beforeEach} from 'vitest';

import {is_build_cache_valid} from '../lib/build_cache.ts';

import {
	create_mock_logger,
	create_mock_config,
	create_mock_build_cache_metadata,
} from './build_cache_test_helpers.ts';

// Mock dependencies
vi.mock('@ryanatkn/belt/git.js', () => ({
	git_current_commit_hash: vi.fn(),
}));

vi.mock('$lib/paths.js', () => ({
	paths: {
		root: './',
		source: './src/',
		lib: './src/lib/',
		build: './.gro/',
		build_dev: './.gro/dev/',
		config: './gro.config.ts',
	},
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

describe('is_build_cache_valid', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('returns true when cache keys match and outputs valid', async () => {
		const {git_current_commit_hash} = await import('@ryanatkn/belt/git.js');
		const {existsSync, readFileSync} = await import('node:fs');
		const {to_hash} = await import('$lib/hash.js');

		const metadata = create_mock_build_cache_metadata({
			git_commit: 'abc123',
			build_cache_config_hash: 'jkl012',
		});

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockReturnValue(JSON.stringify(metadata));
		vi.mocked(git_current_commit_hash).mockResolvedValue('abc123');
		vi.mocked(to_hash).mockResolvedValue('jkl012');

		const config = await create_mock_config();
		const log = create_mock_logger();

		const result = await is_build_cache_valid(config, log);

		expect(result).toBe(true);
		expect(log.info).toHaveBeenCalledWith(
			expect.stringContaining('Build cache valid'),
			expect.anything(),
		);
	});

	test('returns false when no metadata exists', async () => {
		const {existsSync} = await import('node:fs');

		vi.mocked(existsSync).mockReturnValue(false);

		const config = await create_mock_config();
		const log = create_mock_logger();

		const result = await is_build_cache_valid(config, log);

		expect(result).toBe(false);
		expect(log.debug).toHaveBeenCalledWith('No build cache metadata found');
	});

	test('returns false when git commit differs', async () => {
		const {git_current_commit_hash} = await import('@ryanatkn/belt/git.js');
		const {existsSync, readFileSync} = await import('node:fs');

		const metadata = create_mock_build_cache_metadata({git_commit: 'old_commit'});

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockReturnValue(JSON.stringify(metadata));
		vi.mocked(git_current_commit_hash).mockResolvedValue('new_commit');

		const config = await create_mock_config();
		const log = create_mock_logger();

		const result = await is_build_cache_valid(config, log);

		expect(result).toBe(false);
		expect(log.debug).toHaveBeenCalledWith('Build cache invalid: git commit changed');
	});

	test('returns false when build_cache_config hash differs', async () => {
		const {git_current_commit_hash} = await import('@ryanatkn/belt/git.js');
		const {existsSync, readFileSync} = await import('node:fs');
		const {to_hash} = await import('$lib/hash.js');

		const metadata = create_mock_build_cache_metadata({
			git_commit: 'abc123',
			build_cache_config_hash: 'old_config_hash',
		});

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockReturnValue(JSON.stringify(metadata));
		vi.mocked(git_current_commit_hash).mockResolvedValue('abc123');
		vi.mocked(to_hash).mockResolvedValue('new_config_hash');

		const config = await create_mock_config({
			build_cache_config: {changed: true},
		});
		const log = create_mock_logger();

		const result = await is_build_cache_valid(config, log);

		expect(result).toBe(false);
		expect(log.debug).toHaveBeenCalledWith('Build cache invalid: build_cache_config changed');
	});
});
