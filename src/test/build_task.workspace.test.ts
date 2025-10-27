import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest';
import {join} from 'node:path';

import {task as build_task, GIT_SHORT_HASH_LENGTH} from '../lib/build.task.ts';

import {create_mock_build_task_context, create_mock_plugins} from './build_task_test_helpers.ts';

/* eslint-disable @typescript-eslint/require-await */

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

	describe('post-build workspace verification', () => {
		test('throws Task_Error when plugin modifies source files during build', async () => {
			const {git_check_clean_workspace} = vi.mocked(await import('@ryanatkn/belt/git.js'));
			const {is_build_cache_valid} = vi.mocked(await import('../lib/build_cache.ts'));

			// Workspace starts clean, but becomes dirty after build
			let call_count = 0;
			vi.mocked(git_check_clean_workspace).mockImplementation(async () => {
				call_count++;
				// First call: workspace is clean
				// Second call (after build): workspace is dirty!
				return call_count === 1 ? null : 'Modified files:\n  src/lib/foo.ts';
			});
			vi.mocked(is_build_cache_valid).mockResolvedValue(false);

			const ctx = create_mock_build_task_context();

			// Should throw Task_Error with specific message about modified files
			await expect(build_task.run(ctx)).rejects.toThrow(
				/Build process modified tracked files.*src\/lib\/foo\.ts/s,
			);
		});

		test('throws Task_Error when clean workspace becomes dirty with untracked files', async () => {
			const {git_check_clean_workspace} = vi.mocked(await import('@ryanatkn/belt/git.js'));
			const {is_build_cache_valid} = vi.mocked(await import('../lib/build_cache.ts'));

			// Workspace starts clean, but has untracked files after build
			let call_count = 0;
			vi.mocked(git_check_clean_workspace).mockImplementation(async () => {
				call_count++;
				return call_count === 1 ? null : 'Untracked files:\n  src/generated_file.ts';
			});
			vi.mocked(is_build_cache_valid).mockResolvedValue(false);

			const ctx = create_mock_build_task_context();

			// Should throw Task_Error mentioning untracked files
			await expect(build_task.run(ctx)).rejects.toThrow(
				/Build process modified tracked files.*Untracked files/s,
			);
		});

		test('succeeds when workspace stays clean throughout build', async () => {
			const {git_check_clean_workspace} = vi.mocked(await import('@ryanatkn/belt/git.js'));
			const {is_build_cache_valid} = vi.mocked(await import('../lib/build_cache.ts'));

			// Workspace stays clean throughout
			vi.mocked(git_check_clean_workspace).mockResolvedValue(null);
			vi.mocked(is_build_cache_valid).mockResolvedValue(false);

			const ctx = create_mock_build_task_context();

			// Should complete successfully
			await expect(build_task.run(ctx)).resolves.toBeUndefined();
		});

		test('succeeds when dirty workspace stays dirty with same status', async () => {
			const {git_check_clean_workspace} = vi.mocked(await import('@ryanatkn/belt/git.js'));
			const {readdirSync} = await import('node:fs');

			// Workspace stays dirty with same status throughout
			const dirty_status = 'Modified files:\n  src/foo.ts';
			vi.mocked(git_check_clean_workspace).mockResolvedValue(dirty_status);
			vi.mocked(readdirSync).mockReturnValue([]);

			const ctx = create_mock_build_task_context();

			// Should complete successfully (dirty is expected, just can't change)
			await expect(build_task.run(ctx)).resolves.toBeUndefined();
		});

		test('throws Task_Error when dirty workspace gets different dirty status during build', async () => {
			const {git_check_clean_workspace} = vi.mocked(await import('@ryanatkn/belt/git.js'));
			const {readdirSync} = await import('node:fs');

			// Workspace starts with one dirty status, changes to different dirty status
			let call_count = 0;
			vi.mocked(git_check_clean_workspace).mockImplementation(async () => {
				call_count++;
				return call_count === 1
					? 'Modified files:\n  src/foo.ts'
					: 'Modified files:\n  src/foo.ts\n  src/bar.ts'; // Added file!
			});
			vi.mocked(readdirSync).mockReturnValue([]);

			const ctx = create_mock_build_task_context();

			// Should throw - workspace status changed
			await expect(build_task.run(ctx)).rejects.toThrow(/Build process modified tracked files/);
		});
	});
});
