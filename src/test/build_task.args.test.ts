import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest';

import {task as build_task} from '../lib/build.task.ts';

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

describe('build_task args and sync/install', () => {
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

	test('calls sync task when sync is true', async () => {
		const {git_check_clean_workspace} = vi.mocked(await import('@ryanatkn/belt/git.js'));
		const {is_build_cache_valid} = vi.mocked(await import('../lib/build_cache.ts'));

		vi.mocked(git_check_clean_workspace).mockResolvedValue(null);
		vi.mocked(is_build_cache_valid).mockResolvedValue(false);

		const ctx = create_mock_build_task_context({sync: true, install: true});

		await build_task.run(ctx);

		// Should call sync task with install arg
		expect(ctx.invoke_task).toHaveBeenCalledWith('sync', {install: true});
	});

	test('skips sync task when sync is false', async () => {
		const {git_check_clean_workspace} = vi.mocked(await import('@ryanatkn/belt/git.js'));
		const {is_build_cache_valid} = vi.mocked(await import('../lib/build_cache.ts'));

		vi.mocked(git_check_clean_workspace).mockResolvedValue(null);
		vi.mocked(is_build_cache_valid).mockResolvedValue(false);

		const ctx = create_mock_build_task_context({sync: false, install: false});

		await build_task.run(ctx);

		// Should NOT call sync task
		expect(ctx.invoke_task).not.toHaveBeenCalled();
	});

	test('warns when sync is false but install is true', async () => {
		const {git_check_clean_workspace} = vi.mocked(await import('@ryanatkn/belt/git.js'));
		const {is_build_cache_valid} = vi.mocked(await import('../lib/build_cache.ts'));

		vi.mocked(git_check_clean_workspace).mockResolvedValue(null);
		vi.mocked(is_build_cache_valid).mockResolvedValue(false);

		const ctx = create_mock_build_task_context({sync: false, install: true});

		await build_task.run(ctx);

		// Should log warning
		expect(ctx.log.warn).toHaveBeenCalledWith(
			expect.stringContaining('sync is false but install is true'),
		);

		// Should still call sync (install takes precedence)
		expect(ctx.invoke_task).toHaveBeenCalledWith('sync', {install: true});
	});
});
