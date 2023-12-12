import {test} from 'uvu';
import * as assert from 'uvu/assert';

import {update_changelog} from './changelog.js';

// TODO BLOCK add the cache pattern to fetch and cache the fetched data in fixtures
// TODO BLOCK source the bearer token from process.env, then a local .env if it exists, then try ../.env

const fixture_path = 'src/fixtures/changelogs/changelog_DELETEME.md';

test('update_changelog', async () => {
	const result = await update_changelog('grogarden', 'gro', fixture_path);
	assert.ok(result);
});

test.run();
