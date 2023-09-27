import {test} from 'uvu';
import * as assert from 'uvu/assert';

import {
	git_check_clean_workspace,
	git_current_branch_first_commit_hash,
	git_current_branch_name,
	git_current_commit_hash,
} from './git.js';

test('git_current_branch_name', async () => {
	const branch_name = await git_current_branch_name();
	assert.ok(branch_name);
});

test('git_check_clean_workspace', async () => {
	assert.is(await git_check_clean_workspace(), null);
});

test('git_current_commit_hash', async () => {
	const current_commit_hash = await git_current_commit_hash();
	assert.ok(current_commit_hash);
});

test('git_current_branch_first_commit_hash', async () => {
	const first_commit_hash = await git_current_branch_first_commit_hash();
	assert.ok(first_commit_hash);
});

test.run();
