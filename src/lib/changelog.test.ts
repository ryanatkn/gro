import {test} from 'uvu';
import * as assert from 'uvu/assert';
import {Logger} from '@grogarden/util/log.js';

import {update_changelog} from './changelog.js';
import {changelog_cache_fixture} from '$fixtures/changelog_cache.js';

const log = new Logger();
Logger.level = 'debug'; // TODO BLOCK remove

// TODO BLOCK add the cache pattern to fetch and cache the fetched data in fixtures
// TODO BLOCK source the bearer token from process.env, then a local .env if it exists, then try ../.env

const fixture_path = 'src/fixtures/changelog_example.md'; // TODO BLOCK also test the new one
const token = undefined; // TODO BLOCK

test('update_changelog', async () => {
	const result = await update_changelog(
		'grogarden',
		'gro',
		fixture_path,
		token,
		log,
		changelog_cache_fixture,
	);
	assert.ok(result);
});

test.run();
