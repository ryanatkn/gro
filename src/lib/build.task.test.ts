import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest';
import {join} from 'node:path';
import type {Logger} from '@ryanatkn/belt/log.js';
import type {Timings} from '@ryanatkn/belt/timings.js';

import {task as build_task, type Args} from './build.task.ts';
import type {Task_Context, Invoke_Task} from './task.ts';
import type {Gro_Config} from './gro_config.ts';
import type {Parsed_Svelte_Config} from './svelte_config.ts';
import type {Filer} from './filer.ts';

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

vi.mock('./clean_fs.ts', () => ({
	clean_fs: vi.fn(),
}));

vi.mock('./plugin.ts', () => ({
	Plugins: {
		create: vi.fn(),
	},
}));

vi.mock('./build_cache.ts', async (importOriginal) => {
	const original = await importOriginal<typeof import('./build_cache.ts')>();
	return {
		...original,
		is_build_cache_valid: vi.fn(),
		create_build_cache_metadata: vi.fn(),
		save_build_cache_metadata: vi.fn(),
	};
});

vi.mock('./paths.ts', () => ({
	paths: {
		root: './',
		source: './src/',
		lib: './src/lib/',
		build: './.gro/',
		build_dev: './.gro/dev/',
		config: './gro.config.ts',
	},
}));

vi.mock('./hash.ts', () => ({
	to_hash: vi.fn(),
}));

// Helper to create mock logger
const create_mock_logger = (): Logger =>
	({
		error: vi.fn(),
		warn: vi.fn(),
		info: vi.fn(),
		debug: vi.fn(),
		plain: vi.fn(),
		newline: vi.fn(),
	}) as unknown as Logger;

// Helper to create mock config
const create_mock_config = (overrides: Partial<Gro_Config> = {}): Gro_Config =>
	({
		plugins: () => [],
		map_package_json: null,
		task_root_dirs: [],
		search_filters: [],
		js_cli: 'node',
		pm_cli: 'npm',
		build_cache_config: undefined,
		...overrides,
	}) as Gro_Config;

// Helper to create mock svelte config
const create_mock_svelte_config = (): Parsed_Svelte_Config =>
	({
		lib_path: 'src/lib',
		routes_path: 'src/routes',
	}) as Parsed_Svelte_Config;

// Helper to create mock timings
const create_mock_timings = (): Timings =>
	({
		start: vi.fn(() => vi.fn()),
	}) as unknown as Timings;

// Helper to create mock filer
const create_mock_filer = (): Filer =>
	({
		find: vi.fn(),
		create_changeset: vi.fn(),
	}) as unknown as Filer;

// Helper to create mock task context
const create_mock_context = (
	args: Partial<Args> = {},
	config: Partial<Gro_Config> = {},
): Task_Context<Args> => ({
	args: {
		sync: true,
		'no-sync': false,
		install: true,
		'no-install': false,
		force_build: false,
		...args,
	} as Args,
	config: create_mock_config(config),
	svelte_config: create_mock_svelte_config(),
	filer: create_mock_filer(),
	log: create_mock_logger(),
	timings: create_mock_timings(),
	invoke_task: vi.fn() as unknown as Invoke_Task,
});

// Mock plugins interface for testing
interface Mock_Plugins {
	setup: ReturnType<typeof vi.fn>;
	adapt: ReturnType<typeof vi.fn>;
	teardown: ReturnType<typeof vi.fn>;
}

describe('build.task integration tests', () => {
	let mock_plugins: Mock_Plugins;

	beforeEach(async () => {
		vi.clearAllMocks();

		// Setup default mock for plugins
		mock_plugins = {
			setup: vi.fn(),
			adapt: vi.fn(),
			teardown: vi.fn(),
		};

		const {Plugins} = vi.mocked(await import('./plugin.ts'));
		vi.mocked(Plugins.create).mockResolvedValue(mock_plugins as any); // Cast needed due to mock limitations

		// Setup default mocks for clean_fs
		const {clean_fs} = vi.mocked(await import('./clean_fs.ts'));
		vi.mocked(clean_fs).mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	describe('clean workspace with valid cache', () => {
		test('skips build when cache is valid', async () => {
			const {git_check_clean_workspace} = vi.mocked(await import('@ryanatkn/belt/git.js'));
			const {is_build_cache_valid} = vi.mocked(await import('./build_cache.ts'));

			// Workspace is clean, cache is valid
			vi.mocked(git_check_clean_workspace).mockResolvedValue(null);
			vi.mocked(is_build_cache_valid).mockResolvedValue(true);

			const ctx = create_mock_context();
			await build_task.run(ctx);

			// Should check cache
			expect(is_build_cache_valid).toHaveBeenCalledWith(ctx.config, ctx.log);

			// Should not run plugins
			expect(mock_plugins.setup).not.toHaveBeenCalled();
			expect(mock_plugins.adapt).not.toHaveBeenCalled();
			expect(mock_plugins.teardown).not.toHaveBeenCalled();

			// Should log skip message
			expect(ctx.log.info).toHaveBeenCalledWith(
				expect.stringContaining('Skipping build, cache is valid'),
				expect.anything(),
			);
		});

		test('runs build when cache is invalid', async () => {
			const {git_check_clean_workspace, git_current_commit_hash} = vi.mocked(
				await import('@ryanatkn/belt/git.js'),
			);
			const {is_build_cache_valid, create_build_cache_metadata, save_build_cache_metadata} =
				vi.mocked(await import('./build_cache.ts'));
			const {to_hash} = vi.mocked(await import('./hash.ts'));

			// Workspace is clean, cache is invalid
			vi.mocked(git_check_clean_workspace).mockResolvedValue(null);
			vi.mocked(is_build_cache_valid).mockResolvedValue(false);
			vi.mocked(git_current_commit_hash).mockResolvedValue('abc123');
			vi.mocked(to_hash).mockResolvedValue('hash123');

			const mock_metadata = {
				version: '1',
				git_commit: 'abc123',
				build_cache_config_hash: 'hash123',
				timestamp: '2025-10-21T10:00:00.000Z',
				output_hashes: {},
			};
			vi.mocked(create_build_cache_metadata).mockResolvedValue(mock_metadata);

			const ctx = create_mock_context();
			await build_task.run(ctx);

			// Should check cache
			expect(is_build_cache_valid).toHaveBeenCalledWith(ctx.config, ctx.log);

			// Should run full plugin lifecycle
			expect(mock_plugins.setup).toHaveBeenCalled();
			expect(mock_plugins.adapt).toHaveBeenCalled();
			expect(mock_plugins.teardown).toHaveBeenCalled();

			// Should save cache after successful build
			expect(create_build_cache_metadata).toHaveBeenCalledWith(ctx.config, ctx.log);
			expect(save_build_cache_metadata).toHaveBeenCalledWith(mock_metadata);
		});
	});

	describe('dirty workspace behavior', () => {
		test('deletes cache and dist outputs when workspace is dirty', async () => {
			const {git_check_clean_workspace} = vi.mocked(await import('@ryanatkn/belt/git.js'));
			const {existsSync, rmSync, readdirSync} = await import('node:fs');

			// Workspace has uncommitted changes
			vi.mocked(git_check_clean_workspace).mockResolvedValue('Modified files:\n  src/foo.ts');

			// Cache file exists
			vi.mocked(existsSync).mockReturnValue(true);

			// Mock dist directories
			vi.mocked(readdirSync).mockReturnValue(['dist_server', 'dist_worker', 'other'] as any);

			const ctx = create_mock_context();
			await build_task.run(ctx);

			// Should delete cache file
			expect(rmSync).toHaveBeenCalledWith(join('./.gro/', 'build.json'), {force: true});

			// Should delete dist/ directory
			expect(rmSync).toHaveBeenCalledWith('dist', {recursive: true, force: true});

			// Should delete all dist_* directories
			expect(rmSync).toHaveBeenCalledWith('dist_server', {recursive: true, force: true});
			expect(rmSync).toHaveBeenCalledWith('dist_worker', {recursive: true, force: true});

			// Should not delete non-dist directories
			expect(rmSync).not.toHaveBeenCalledWith('other', expect.anything());

			// Should log dirty workspace message
			expect(ctx.log.info).toHaveBeenCalledWith(
				expect.stringContaining('Workspace has uncommitted changes'),
			);
		});

		test('runs full build when workspace is dirty', async () => {
			const {git_check_clean_workspace} = vi.mocked(await import('@ryanatkn/belt/git.js'));
			const {is_build_cache_valid} = vi.mocked(await import('./build_cache.ts'));
			const {readdirSync} = await import('node:fs');

			// Workspace has uncommitted changes
			vi.mocked(git_check_clean_workspace).mockResolvedValue('Modified files:\n  src/foo.ts');
			vi.mocked(readdirSync).mockReturnValue([]);

			const ctx = create_mock_context();
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
			const {save_build_cache_metadata} = vi.mocked(await import('./build_cache.ts'));
			const {readdirSync} = await import('node:fs');

			// Workspace has uncommitted changes
			vi.mocked(git_check_clean_workspace).mockResolvedValue('Modified files:\n  src/foo.ts');
			vi.mocked(readdirSync).mockReturnValue([]);

			const ctx = create_mock_context();
			await build_task.run(ctx);

			// Should NOT save cache after build
			expect(save_build_cache_metadata).not.toHaveBeenCalled();
		});

		test('handles missing cache file gracefully when workspace is dirty', async () => {
			const {git_check_clean_workspace} = vi.mocked(await import('@ryanatkn/belt/git.js'));
			const {existsSync, rmSync, readdirSync} = await import('node:fs');

			// Workspace has uncommitted changes
			vi.mocked(git_check_clean_workspace).mockResolvedValue('Modified files:\n  src/foo.ts');

			// Cache file does not exist, dist dirs exist
			vi.mocked(existsSync).mockImplementation((path: any) => {
				const path_str = String(path);
				if (path_str.includes('build.json')) return false; // Cache file doesn't exist
				return true; // dist dirs exist
			});

			vi.mocked(readdirSync).mockReturnValue([]);

			const ctx = create_mock_context();
			await build_task.run(ctx);

			// Should NOT delete cache file since it doesn't exist
			expect(rmSync).not.toHaveBeenCalledWith(join('./.gro/', 'build.json'), {force: true});

			// Should still delete dist/ (since it exists)
			expect(rmSync).toHaveBeenCalledWith('dist', {recursive: true, force: true});

			// Should not throw
			expect(mock_plugins.setup).toHaveBeenCalled();
		});

		test('handles missing dist directories gracefully when workspace is dirty', async () => {
			const {git_check_clean_workspace} = vi.mocked(await import('@ryanatkn/belt/git.js'));
			const {existsSync, rmSync, readdirSync} = await import('node:fs');

			// Workspace has uncommitted changes
			vi.mocked(git_check_clean_workspace).mockResolvedValue('Modified files:\n  src/foo.ts');

			// Cache file exists, dist directories don't exist
			vi.mocked(existsSync).mockImplementation((path: any) => {
				const path_str = String(path);
				if (path_str.includes('build.json')) return true; // Cache file exists
				return false; // Dist dirs don't exist
			});

			vi.mocked(readdirSync).mockReturnValue([]);

			const ctx = create_mock_context();
			await build_task.run(ctx);

			// Should delete cache file (since it exists)
			expect(rmSync).toHaveBeenCalledWith(join('./.gro/', 'build.json'), {force: true});

			// Should NOT delete dist/ since it doesn't exist
			expect(rmSync).not.toHaveBeenCalledWith('dist', {recursive: true, force: true});

			// Should not throw
			expect(mock_plugins.setup).toHaveBeenCalled();
		});
	});

	describe('force_build flag', () => {
		test('forces rebuild even when cache is valid', async () => {
			const {git_check_clean_workspace} = vi.mocked(await import('@ryanatkn/belt/git.js'));
			const {is_build_cache_valid} = vi.mocked(await import('./build_cache.ts'));

			// Workspace is clean, cache would be valid, but force_build is true
			vi.mocked(git_check_clean_workspace).mockResolvedValue(null);
			vi.mocked(is_build_cache_valid).mockResolvedValue(true);

			const ctx = create_mock_context({force_build: true});
			await build_task.run(ctx);

			// Should NOT check cache (bypassed by force_build)
			expect(is_build_cache_valid).not.toHaveBeenCalled();

			// Should run full plugin lifecycle
			expect(mock_plugins.setup).toHaveBeenCalled();
			expect(mock_plugins.adapt).toHaveBeenCalled();
			expect(mock_plugins.teardown).toHaveBeenCalled();

			// Should log force build message
			expect(ctx.log.info).toHaveBeenCalledWith(expect.stringContaining('Forcing fresh build'));
		});

		test('saves cache when force_build with clean workspace', async () => {
			const {git_check_clean_workspace, git_current_commit_hash} = vi.mocked(
				await import('@ryanatkn/belt/git.js'),
			);
			const {save_build_cache_metadata, create_build_cache_metadata} = vi.mocked(
				await import('./build_cache.ts'),
			);
			const {to_hash} = vi.mocked(await import('./hash.ts'));

			// Workspace is clean, force_build is true
			vi.mocked(git_check_clean_workspace).mockResolvedValue(null);
			vi.mocked(git_current_commit_hash).mockResolvedValue('abc123');
			vi.mocked(to_hash).mockResolvedValue('hash123');

			const mock_metadata = {
				version: '1',
				git_commit: 'abc123',
				build_cache_config_hash: 'hash123',
				timestamp: '2025-10-21T10:00:00.000Z',
				output_hashes: {},
			};
			vi.mocked(create_build_cache_metadata).mockResolvedValue(mock_metadata);

			const ctx = create_mock_context({force_build: true});
			await build_task.run(ctx);

			// Should save cache after successful build (workspace is clean)
			expect(save_build_cache_metadata).toHaveBeenCalledWith(mock_metadata);
		});

		test('still deletes dist when force_build with dirty workspace', async () => {
			const {git_check_clean_workspace} = vi.mocked(await import('@ryanatkn/belt/git.js'));
			const {existsSync, rmSync, readdirSync} = await import('node:fs');

			// Workspace is dirty, force_build is true
			vi.mocked(git_check_clean_workspace).mockResolvedValue('Modified files:\n  src/foo.ts');
			vi.mocked(existsSync).mockReturnValue(true); // All files exist
			vi.mocked(readdirSync).mockReturnValue(['dist_server'] as any);

			const ctx = create_mock_context({force_build: true});
			await build_task.run(ctx);

			// Should still delete dist outputs (dirty workspace protection)
			expect(rmSync).toHaveBeenCalledWith('dist', {recursive: true, force: true});
			expect(rmSync).toHaveBeenCalledWith('dist_server', {recursive: true, force: true});
		});
	});

	describe('sync and install flags', () => {
		test('calls sync task when sync is true', async () => {
			const {git_check_clean_workspace} = vi.mocked(await import('@ryanatkn/belt/git.js'));
			const {is_build_cache_valid} = vi.mocked(await import('./build_cache.ts'));

			vi.mocked(git_check_clean_workspace).mockResolvedValue(null);
			vi.mocked(is_build_cache_valid).mockResolvedValue(false);

			const ctx = create_mock_context({sync: true, install: true});
			await build_task.run(ctx);

			// Should call sync task with install arg
			expect(ctx.invoke_task).toHaveBeenCalledWith('sync', {install: true});
		});

		test('skips sync task when sync is false', async () => {
			const {git_check_clean_workspace} = vi.mocked(await import('@ryanatkn/belt/git.js'));
			const {is_build_cache_valid} = vi.mocked(await import('./build_cache.ts'));

			vi.mocked(git_check_clean_workspace).mockResolvedValue(null);
			vi.mocked(is_build_cache_valid).mockResolvedValue(false);

			const ctx = create_mock_context({sync: false, install: false});
			await build_task.run(ctx);

			// Should NOT call sync task
			expect(ctx.invoke_task).not.toHaveBeenCalled();
		});

		test('warns when sync is false but install is true', async () => {
			const {git_check_clean_workspace} = vi.mocked(await import('@ryanatkn/belt/git.js'));
			const {is_build_cache_valid} = vi.mocked(await import('./build_cache.ts'));

			vi.mocked(git_check_clean_workspace).mockResolvedValue(null);
			vi.mocked(is_build_cache_valid).mockResolvedValue(false);

			const ctx = create_mock_context({sync: false, install: true});
			await build_task.run(ctx);

			// Should log warning
			expect(ctx.log.warn).toHaveBeenCalledWith(
				expect.stringContaining('sync is false but install is true'),
			);

			// Should still call sync (install takes precedence)
			expect(ctx.invoke_task).toHaveBeenCalledWith('sync', {install: true});
		});
	});

	describe('plugin lifecycle', () => {
		test('runs plugin lifecycle in correct order', async () => {
			const {git_check_clean_workspace} = vi.mocked(await import('@ryanatkn/belt/git.js'));
			const {is_build_cache_valid} = vi.mocked(await import('./build_cache.ts'));

			vi.mocked(git_check_clean_workspace).mockResolvedValue(null);
			vi.mocked(is_build_cache_valid).mockResolvedValue(false);

			const call_order: Array<string> = [];
			mock_plugins.setup.mockImplementation(() => call_order.push('setup'));
			mock_plugins.adapt.mockImplementation(() => call_order.push('adapt'));
			mock_plugins.teardown.mockImplementation(() => call_order.push('teardown'));

			const ctx = create_mock_context();
			await build_task.run(ctx);

			expect(call_order).toEqual(['setup', 'adapt', 'teardown']);
		});

		test('creates plugins with correct context', async () => {
			const {git_check_clean_workspace} = vi.mocked(await import('@ryanatkn/belt/git.js'));
			const {is_build_cache_valid} = vi.mocked(await import('./build_cache.ts'));
			const {Plugins} = vi.mocked(await import('./plugin.ts'));

			vi.mocked(git_check_clean_workspace).mockResolvedValue(null);
			vi.mocked(is_build_cache_valid).mockResolvedValue(false);

			const ctx = create_mock_context();
			await build_task.run(ctx);

			expect(Plugins.create).toHaveBeenCalledWith(
				expect.objectContaining({
					dev: false,
					watch: false,
					config: ctx.config,
					log: ctx.log,
				}),
			);
		});
	});

	describe('clean_fs integration', () => {
		test('calls clean_fs before building', async () => {
			const {git_check_clean_workspace} = vi.mocked(await import('@ryanatkn/belt/git.js'));
			const {is_build_cache_valid} = vi.mocked(await import('./build_cache.ts'));
			const {clean_fs} = vi.mocked(await import('./clean_fs.ts'));

			vi.mocked(git_check_clean_workspace).mockResolvedValue(null);
			vi.mocked(is_build_cache_valid).mockResolvedValue(false);

			const ctx = create_mock_context();
			await build_task.run(ctx);

			expect(clean_fs).toHaveBeenCalledWith({build_dist: true});
		});
	});

	describe('error handling', () => {
		test('handles git command failures gracefully', async () => {
			const {git_check_clean_workspace} = vi.mocked(await import('@ryanatkn/belt/git.js'));

			// Git command throws an error
			vi.mocked(git_check_clean_workspace).mockRejectedValue(new Error('git command not found'));

			const ctx = create_mock_context();

			// Should throw - git errors are fatal
			await expect(build_task.run(ctx)).rejects.toThrow('git command not found');
		});

		test('handles file system errors during cache deletion', async () => {
			const {git_check_clean_workspace} = vi.mocked(await import('@ryanatkn/belt/git.js'));
			const {existsSync, rmSync, readdirSync} = await import('node:fs');

			// Workspace is dirty
			vi.mocked(git_check_clean_workspace).mockResolvedValue('Modified files:\n  src/foo.ts');
			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(readdirSync).mockReturnValue([]);

			// rmSync throws an error
			vi.mocked(rmSync).mockImplementation(() => {
				throw new Error('Permission denied');
			});

			const ctx = create_mock_context();

			// Should throw - filesystem errors are fatal
			await expect(build_task.run(ctx)).rejects.toThrow('Permission denied');
		});

		test('handles cache validation errors gracefully', async () => {
			const {git_check_clean_workspace} = vi.mocked(await import('@ryanatkn/belt/git.js'));
			const {is_build_cache_valid} = vi.mocked(await import('./build_cache.ts'));

			// Workspace is clean, but cache validation throws
			vi.mocked(git_check_clean_workspace).mockResolvedValue(null);
			vi.mocked(is_build_cache_valid).mockRejectedValue(new Error('Failed to read cache file'));

			const ctx = create_mock_context();

			// Should throw - cache validation errors are fatal
			await expect(build_task.run(ctx)).rejects.toThrow('Failed to read cache file');
		});
	});
});
