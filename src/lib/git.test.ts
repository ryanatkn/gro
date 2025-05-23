import {test} from 'uvu';
import * as assert from 'uvu/assert';

import {
	git_check_clean_workspace,
	git_check_fully_staged_workspace,
	git_current_branch_first_commit_hash,
	git_current_branch_name,
	git_current_commit_hash,
} from './git.ts';

test('git_current_branch_name', async () => {
	const branch_name = await git_current_branch_name();
	assert.ok(branch_name);
});

test('git_check_clean_workspace', async () => {
	await git_check_clean_workspace();
});

test('git_check_fully_staged_workspace', async () => {
	await git_check_fully_staged_workspace();
});

test('git_current_commit_hash', async () => {
	await git_current_commit_hash();
});

test('git_current_branch_first_commit_hash', async () => {
	const first_commit_hash = await git_current_branch_first_commit_hash();
	assert.ok(first_commit_hash);
});

test.run();
