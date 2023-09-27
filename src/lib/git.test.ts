import {test} from 'uvu';
import * as assert from 'uvu/assert';

import {
	git_check_clean_workspace,
	git_current_branch_first_commit_hash,
	git_current_branch_name,
	git_current_commit_hash,
	git_local_branch_exists,
} from './git.js';

test('git_current_branch_name and git_local_branch_exists', async () => {
	const branch_name = await git_current_branch_name();
	assert.ok(branch_name);
	assert.ok(await git_local_branch_exists(branch_name));
});

test('git_check_clean_workspace', async () => {
	assert.ok(await git_check_clean_workspace());
});

test('git_current_branch_first_commit_hash', async () => {
	assert.ok(await git_current_branch_first_commit_hash());
});

test('git_current_commit_hash', async () => {
	assert.ok(await git_current_commit_hash());
});

test.run();
