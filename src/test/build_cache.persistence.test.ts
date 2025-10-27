import {describe, test, expect, vi, beforeEach} from 'vitest';

import {load_build_cache_metadata, save_build_cache_metadata} from '../lib/build_cache.ts';

import {create_mock_logger, create_mock_build_cache_metadata} from './build_cache_test_helpers.ts';

// Mock dependencies
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

describe('load_build_cache_metadata', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('loads valid metadata file', async () => {
		const {existsSync, readFileSync} = await import('node:fs');

		const metadata = create_mock_build_cache_metadata();
		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockReturnValue(JSON.stringify(metadata));

		const result = load_build_cache_metadata();

		expect(result).toEqual(metadata);
	});

	test('returns null for non-existent file', async () => {
		const {existsSync} = await import('node:fs');

		vi.mocked(existsSync).mockReturnValue(false);

		const result = load_build_cache_metadata();

		expect(result).toBeNull();
	});

	test('returns null for invalid JSON', async () => {
		const {existsSync, readFileSync} = await import('node:fs');

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockReturnValue('invalid json{');

		const result = load_build_cache_metadata();

		expect(result).toBeNull();
	});

	test('returns null for wrong schema version', async () => {
		const {existsSync, readFileSync} = await import('node:fs');

		const metadata = create_mock_build_cache_metadata({version: '999'});
		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockReturnValue(JSON.stringify(metadata));

		const result = load_build_cache_metadata();

		expect(result).toBeNull();
	});

	test('deletes cache file on schema version mismatch', async () => {
		const {existsSync, readFileSync, rmSync} = await import('node:fs');

		const metadata = create_mock_build_cache_metadata({version: '999'});
		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockReturnValue(JSON.stringify(metadata));

		load_build_cache_metadata();

		expect(rmSync).toHaveBeenCalledWith('.gro/build.json', {force: true});
	});

	test('deletes cache file on corrupted JSON', async () => {
		const {existsSync, readFileSync, rmSync} = await import('node:fs');

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockReturnValue('invalid json{');

		load_build_cache_metadata();

		expect(rmSync).toHaveBeenCalledWith('.gro/build.json', {force: true});
	});

	test('handles cleanup errors gracefully', async () => {
		const {existsSync, readFileSync, rmSync} = await import('node:fs');

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockReturnValue('invalid json{');
		vi.mocked(rmSync).mockImplementation(() => {
			throw new Error('Permission denied');
		});

		// Should not throw despite cleanup error
		expect(() => load_build_cache_metadata()).not.toThrow();
		expect(load_build_cache_metadata()).toBeNull();
	});

	test('returns null for empty file', async () => {
		const {existsSync, readFileSync} = await import('node:fs');

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockReturnValue('');

		const result = load_build_cache_metadata();

		expect(result).toBeNull();
	});

	test('returns null for valid JSON with wrong version', async () => {
		const {existsSync, readFileSync} = await import('node:fs');

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockReturnValue(
			JSON.stringify(create_mock_build_cache_metadata({version: 'wrong'})),
		);

		const result = load_build_cache_metadata();

		expect(result).toBeNull();
	});

	test('returns null for truncated JSON file', async () => {
		const {existsSync, readFileSync} = await import('node:fs');

		// Simulate truncated write (incomplete JSON)
		const truncated = '{"version":"1","git_commit":"abc123","build_cache_config_hash":"hash","tim';

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockReturnValue(truncated);

		const result = load_build_cache_metadata();

		expect(result).toBeNull();
	});

	test('rejects cache with missing required fields (Zod validation)', async () => {
		const {existsSync, readFileSync} = await import('node:fs');

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockReturnValue(
			JSON.stringify({
				version: '1',
				git_commit: 'abc123',
				// missing build_cache_config_hash
				timestamp: '2025-10-23T12:00:00Z',
				outputs: [],
			}),
		);

		const result = load_build_cache_metadata();

		expect(result).toBeNull();
	});

	test('rejects cache with wrong field types (Zod validation)', async () => {
		const {existsSync, readFileSync} = await import('node:fs');

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockReturnValue(
			JSON.stringify({
				version: 1, // should be string
				git_commit: 'abc123',
				build_cache_config_hash: 'hash',
				timestamp: '2025-10-23T12:00:00Z',
				outputs: [],
			}),
		);

		const result = load_build_cache_metadata();

		expect(result).toBeNull();
	});

	test('rejects cache with unexpected extra fields (strictObject)', async () => {
		const {existsSync, readFileSync} = await import('node:fs');

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockReturnValue(
			JSON.stringify({...create_mock_build_cache_metadata(), unexpected_field: 'bad'}),
		);

		const result = load_build_cache_metadata();

		expect(result).toBeNull();
	});

	test('rejects cache with invalid outputs type', async () => {
		const {existsSync, readFileSync} = await import('node:fs');

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(readFileSync).mockReturnValue(
			JSON.stringify({...create_mock_build_cache_metadata(), outputs: 'not-an-array'}),
		);

		const result = load_build_cache_metadata();

		expect(result).toBeNull();
	});
});

describe('save_build_cache_metadata', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('writes metadata to correct path', async () => {
		const {writeFileSync, mkdirSync} = await import('node:fs');

		const metadata = create_mock_build_cache_metadata();

		save_build_cache_metadata(metadata);

		expect(mkdirSync).toHaveBeenCalledWith('./.gro/', {recursive: true});
		expect(writeFileSync).toHaveBeenCalledWith('.gro/build.json', expect.any(String), 'utf-8');
	});

	test('uses proper JSON formatting with tabs', async () => {
		const {writeFileSync} = await import('node:fs');

		const metadata = create_mock_build_cache_metadata();

		save_build_cache_metadata(metadata);

		const written_content = vi.mocked(writeFileSync).mock.calls[0]![1] as string;
		expect(written_content).toContain('\t');
		expect(JSON.parse(written_content)).toEqual(metadata);
	});

	test('logs warning on write error', async () => {
		const {writeFileSync} = await import('node:fs');

		const metadata = create_mock_build_cache_metadata();
		const log = create_mock_logger();

		vi.mocked(writeFileSync).mockImplementation(() => {
			throw new Error('ENOSPC: no space left on device');
		});

		save_build_cache_metadata(metadata, log);

		expect(log.warn).toHaveBeenCalledWith(
			expect.stringContaining('Failed to save build cache'),
			expect.stringContaining('no space left on device'),
		);
	});

	test('does not throw on write error', async () => {
		const {writeFileSync} = await import('node:fs');

		const metadata = create_mock_build_cache_metadata();

		vi.mocked(writeFileSync).mockImplementation(() => {
			throw new Error('EACCES: permission denied');
		});

		// Should not throw despite write error
		expect(() => save_build_cache_metadata(metadata)).not.toThrow();
	});

	test('handles write error without logger', async () => {
		const {writeFileSync} = await import('node:fs');

		const metadata = create_mock_build_cache_metadata();

		vi.mocked(writeFileSync).mockImplementation(() => {
			throw new Error('Write failed');
		});

		// Should not throw even without logger (log?.warn is safe)
		expect(() => save_build_cache_metadata(metadata)).not.toThrow();
	});
});
