import {describe, test, expect, vi, beforeEach} from 'vitest';

import {git_current_commit_hash} from './git.ts';

// Mock the spawn_out function
vi.mock('@ryanatkn/belt/process.js', () => ({
	spawn_out: vi.fn(),
}));

describe('git_current_commit_hash', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('returns valid hash in a git repository', async () => {
		const {spawn_out} = await import('@ryanatkn/belt/process.js');

		// Mock successful git command with a realistic commit hash
		vi.mocked(spawn_out).mockResolvedValue({
			result: {ok: true} as any,
			stdout: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0\n',
			stderr: null,
		});

		const hash = await git_current_commit_hash();

		expect(hash).toBe('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0');
		expect(spawn_out).toHaveBeenCalledWith('git', ['rev-parse', 'HEAD']);
	});

	test('returns null when not in a git repository', async () => {
		const {spawn_out} = await import('@ryanatkn/belt/process.js');

		// Mock git command failure (not a git repo)
		vi.mocked(spawn_out).mockResolvedValue({
			result: {ok: false} as any,
			stdout: null,
			stderr: 'fatal: not a git repository',
		});

		const hash = await git_current_commit_hash();

		expect(hash).toBeNull();
	});

	test('returns null when git command fails', async () => {
		const {spawn_out} = await import('@ryanatkn/belt/process.js');

		// Mock git command failure
		vi.mocked(spawn_out).mockResolvedValue({
			result: {ok: false} as any,
			stdout: null,
			stderr: 'error: some git error',
		});

		const hash = await git_current_commit_hash();

		expect(hash).toBeNull();
	});

	test('returns null when stdout is null', async () => {
		const {spawn_out} = await import('@ryanatkn/belt/process.js');

		// Mock successful command but null stdout
		vi.mocked(spawn_out).mockResolvedValue({
			result: {ok: true} as any,
			stdout: null,
			stderr: null,
		});

		const hash = await git_current_commit_hash();

		expect(hash).toBeNull();
	});

	test('trims whitespace from hash', async () => {
		const {spawn_out} = await import('@ryanatkn/belt/process.js');

		// Mock git command with whitespace
		vi.mocked(spawn_out).mockResolvedValue({
			result: {ok: true} as any,
			stdout: '  a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0  \n  ',
			stderr: null,
		});

		const hash = await git_current_commit_hash();

		expect(hash).toBe('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0');
	});

	test('hash has correct format (40 characters)', async () => {
		const {spawn_out} = await import('@ryanatkn/belt/process.js');

		vi.mocked(spawn_out).mockResolvedValue({
			result: {ok: true} as any,
			stdout: '0123456789abcdef0123456789abcdef01234567\n',
			stderr: null,
		});

		const hash = await git_current_commit_hash();

		expect(hash).toBeTruthy();
		expect(hash?.length).toBe(40);
		expect(hash).toMatch(/^[0-9a-f]{40}$/);
	});
});
