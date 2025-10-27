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

describe('build_task plugin lifecycle', () => {
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

	test('runs plugin lifecycle in correct order', async () => {
		const {git_check_clean_workspace} = vi.mocked(await import('@ryanatkn/belt/git.js'));
		const {is_build_cache_valid} = vi.mocked(await import('../lib/build_cache.ts'));
		const {Plugins} = vi.mocked(await import('../lib/plugin.ts'));
		const mock_plugins = create_mock_plugins();
		vi.mocked(Plugins.create).mockResolvedValue(mock_plugins as any);

		vi.mocked(git_check_clean_workspace).mockResolvedValue(null);
		vi.mocked(is_build_cache_valid).mockResolvedValue(false);

		const call_order: Array<string> = [];
		mock_plugins.setup.mockImplementation(() => call_order.push('setup'));
		mock_plugins.adapt.mockImplementation(() => call_order.push('adapt'));
		mock_plugins.teardown.mockImplementation(() => call_order.push('teardown'));

		const ctx = create_mock_build_task_context();

		await build_task.run(ctx);

		expect(call_order).toEqual(['setup', 'adapt', 'teardown']);
	});

	test('creates plugins with correct context', async () => {
		const {git_check_clean_workspace} = vi.mocked(await import('@ryanatkn/belt/git.js'));
		const {is_build_cache_valid} = vi.mocked(await import('../lib/build_cache.ts'));
		const {Plugins} = vi.mocked(await import('../lib/plugin.ts'));

		vi.mocked(git_check_clean_workspace).mockResolvedValue(null);
		vi.mocked(is_build_cache_valid).mockResolvedValue(false);

		const ctx = create_mock_build_task_context();

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

	test('calls clean_fs before building', async () => {
		const {git_check_clean_workspace} = vi.mocked(await import('@ryanatkn/belt/git.js'));
		const {is_build_cache_valid} = vi.mocked(await import('../lib/build_cache.ts'));
		const {clean_fs} = vi.mocked(await import('../lib/clean_fs.ts'));

		vi.mocked(git_check_clean_workspace).mockResolvedValue(null);
		vi.mocked(is_build_cache_valid).mockResolvedValue(false);

		const ctx = create_mock_build_task_context();

		await build_task.run(ctx);

		expect(clean_fs).toHaveBeenCalledWith({build_dist: true});
	});
});
