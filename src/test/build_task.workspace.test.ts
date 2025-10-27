import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest';
import {join} from 'node:path';

import {task as build_task, GIT_SHORT_HASH_LENGTH} from '../lib/build.task.ts';

import {create_mock_build_task_context, create_mock_plugins} from './build_task_test_helpers.ts';

// Mock dependencies
vi.mock('@ryanatkn/belt/git.js', () => ({
	git_check_clean_workspace: vi.fn(),
	git_current_commit_hash: vi.fn(),
}));

vi.mock('node:fs', () => ({
	existsSync: vi.fn(),
	rmSync: vi.fn(),
	mkdirSync: vi.fn(),
	readFileSync: vi.fn(),
	writeFileSync: vi.fn(),
	readdirSync: vi.fn(),
	statSync: vi.fn(),
}));

vi.mock('../lib/clean_fs.ts', () => ({
	clean_fs: vi.fn(),
}));

vi.mock('../lib/plugin.ts', () => ({
	Plugins: {
		create: vi.fn(),
	},
}));

vi.mock('../lib/build_cache.ts', async (importOriginal) => {
	const original = await importOriginal<typeof import('../lib/build_cache.ts')>();
	return {
		...original,
		is_build_cache_valid: vi.fn(),
		create_build_cache_metadata: vi.fn(),
		save_build_cache_metadata: vi.fn(),
	};
});

vi.mock('../lib/paths.ts', () => ({
	paths: {
		root: './',
		source: './src/',
		lib: './src/lib/',
		build: './.gro/',
		build_dev: './.gro/dev/',
		config: './gro.config.ts',
	},
}));

vi.mock('../lib/hash.ts', () => ({
	to_hash: vi.fn(),
}));

describe('build_task workspace state', () => {
	beforeEach(async () => {
		vi.clearAllMocks();

		// Setup default mocks
		const mock_plugins = create_mock_plugins();
		const {Plugins} = vi.mocked(await import('../lib/plugin.ts'));
		vi.mocked(Plugins.create).mockResolvedValue(mock_plugins as any);

		const {clean_fs} = vi.mocked(await import('../lib/clean_fs.ts'));
		vi.mocked(clean_fs).mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	test('GIT_SHORT_HASH_LENGTH constant matches git convention', () => {
		// Verify the constant is set to standard git short hash length
		expect(GIT_SHORT_HASH_LENGTH).toBe(7);
	});

	test('deletes cache and dist outputs when workspace is dirty', async () => {
		const {git_check_clean_workspace} = vi.mocked(await import('@ryanatkn/belt/git.js'));
		const {existsSync, rmSync, readdirSync, statSync} = await import('node:fs');

		// workspace has uncommitted changes
		vi.mocked(git_check_clean_workspace).mockResolvedValue('Modified files:\n  src/foo.ts');

		// Cache file and all build dirs exist
		vi.mocked(existsSync).mockReturnValue(true);

		// Mock discover_build_output_dirs() internals
		vi.mocked(readdirSync).mockReturnValue(['dist_server', 'dist_worker', 'other'] as any);
		vi.mocked(statSync).mockReturnValue({isDirectory: () => true} as any);

		const ctx = create_mock_build_task_context();

		await build_task.run(ctx);

		// Should delete cache file
		expect(rmSync).toHaveBeenCalledWith(join('./.gro/', 'build.json'), {force: true});

		// Should delete build/ directory (via discover_build_output_dirs)
		expect(rmSync).toHaveBeenCalledWith('build', {recursive: true, force: true});

		// Should delete dist/ directory
		expect(rmSync).toHaveBeenCalledWith('dist', {recursive: true, force: true});

		// Should delete all dist_* directories
		expect(rmSync).toHaveBeenCalledWith('dist_server', {recursive: true, force: true});
		expect(rmSync).toHaveBeenCalledWith('dist_worker', {recursive: true, force: true});

		// Should not delete non-build directories
		expect(rmSync).not.toHaveBeenCalledWith('other', expect.anything());

		// Should log dirty workspace message
		expect(ctx.log.info).toHaveBeenCalledWith(
			expect.stringContaining('workspace has uncommitted changes'),
		);
	});

	test('runs full build when workspace is dirty', async () => {
		const {git_check_clean_workspace} = vi.mocked(await import('@ryanatkn/belt/git.js'));
		const {is_build_cache_valid} = vi.mocked(await import('../lib/build_cache.ts'));
		const {readdirSync} = await import('node:fs');
		const {Plugins} = vi.mocked(await import('../lib/plugin.ts'));
		const mock_plugins = create_mock_plugins();
		vi.mocked(Plugins.create).mockResolvedValue(mock_plugins as any);

		// workspace has uncommitted changes
		vi.mocked(git_check_clean_workspace).mockResolvedValue('Modified files:\n  src/foo.ts');
		vi.mocked(readdirSync).mockReturnValue([]);

		const ctx = create_mock_build_task_context();

		await build_task.run(ctx);

		// Should NOT check cache (skipped due to dirty workspace)
		expect(is_build_cache_valid).not.toHaveBeenCalled();

		// Should run full plugin lifecycle
		expect(mock_plugins.setup).toHaveBeenCalled();
		expect(mock_plugins.adapt).toHaveBeenCalled();
		expect(mock_plugins.teardown).toHaveBeenCalled();
	});

	test('does not save cache when workspace is dirty', async () => {
		const {git_check_clean_workspace} = vi.mocked(await import('@ryanatkn/belt/git.js'));
		const {save_build_cache_metadata} = vi.mocked(await import('../lib/build_cache.ts'));
		const {readdirSync} = await import('node:fs');

		// workspace has uncommitted changes
		vi.mocked(git_check_clean_workspace).mockResolvedValue('Modified files:\n  src/foo.ts');
		vi.mocked(readdirSync).mockReturnValue([]);

		const ctx = create_mock_build_task_context();

		await build_task.run(ctx);

		// Should NOT save cache after build
		expect(save_build_cache_metadata).not.toHaveBeenCalled();
	});

	test('handles missing cache file gracefully when workspace is dirty', async () => {
		const {git_check_clean_workspace} = vi.mocked(await import('@ryanatkn/belt/git.js'));
		const {existsSync, rmSync, readdirSync, statSync} = await import('node:fs');
		const {Plugins} = vi.mocked(await import('../lib/plugin.ts'));
		const mock_plugins = create_mock_plugins();
		vi.mocked(Plugins.create).mockResolvedValue(mock_plugins as any);

		// workspace has uncommitted changes
		vi.mocked(git_check_clean_workspace).mockResolvedValue('Modified files:\n  src/foo.ts');

		// Cache file does not exist, but build dirs do
		vi.mocked(existsSync).mockImplementation((path: any) => {
			const path_str = String(path);
			if (path_str.includes('build.json')) return false; // Cache file doesn't exist
			return true; // build dirs exist
		});
		vi.mocked(readdirSync).mockReturnValue([]);
		vi.mocked(statSync).mockReturnValue({isDirectory: () => true} as any);

		const ctx = create_mock_build_task_context();

		await build_task.run(ctx);

		// Should NOT delete cache file since it doesn't exist
		expect(rmSync).not.toHaveBeenCalledWith(join('./.gro/', 'build.json'), {force: true});

		// Should still delete build outputs (since they exist via discover_build_output_dirs)
		expect(rmSync).toHaveBeenCalledWith('build', {recursive: true, force: true});
		expect(rmSync).toHaveBeenCalledWith('dist', {recursive: true, force: true});

		// Should not throw
		expect(mock_plugins.setup).toHaveBeenCalled();
	});

	test('handles missing dist directories gracefully when workspace is dirty', async () => {
		const {git_check_clean_workspace} = vi.mocked(await import('@ryanatkn/belt/git.js'));
		const {existsSync, rmSync, readdirSync} = await import('node:fs');
		const {Plugins} = vi.mocked(await import('../lib/plugin.ts'));
		const mock_plugins = create_mock_plugins();
		vi.mocked(Plugins.create).mockResolvedValue(mock_plugins as any);

		// workspace has uncommitted changes
		vi.mocked(git_check_clean_workspace).mockResolvedValue('Modified files:\n  src/foo.ts');

		// Cache file exists, no build directories exist
		vi.mocked(existsSync).mockImplementation((path: any) => {
			const path_str = String(path);
			if (path_str.includes('build.json')) return true; // Cache file exists
			return false; // No build dirs exist
		});
		vi.mocked(readdirSync).mockReturnValue([]); // No dist_* directories

		const ctx = create_mock_build_task_context();

		await build_task.run(ctx);

		// Should delete cache file (since it exists)
		expect(rmSync).toHaveBeenCalledWith(join('./.gro/', 'build.json'), {force: true});

		// Should NOT delete build/dist since they don't exist (discover_build_output_dirs returns empty)
		expect(rmSync).not.toHaveBeenCalledWith('build', expect.anything());
		expect(rmSync).not.toHaveBeenCalledWith('dist', expect.anything());

		// Should not throw
		expect(mock_plugins.setup).toHaveBeenCalled();
	});
});
