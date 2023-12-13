import {test} from 'uvu';
import * as assert from 'uvu/assert';
import {Logger} from '@grogarden/util/log.js';
import dotenv from 'dotenv';
import {readFile, writeFile} from 'fs/promises';

import {update_changelog} from './changelog.js';
import {changelog_cache_fixture} from '$fixtures/changelog_cache.js';

dotenv.config();
const token = process.env.GITHUB_TOKEN_SECRET;

const log = new Logger();
Logger.level = 'debug'; // TODO BLOCK

// TODO BLOCK add the cache pattern to fetch and cache the fetched data in fixtures
// TODO BLOCK source the bearer token from process.env, then a local .env if it exists, then try ../.env

const fixture_path = 'src/fixtures/changelog_example.md'; // TODO BLOCK also test the new one

test('update_changelog', async () => {
	const original = await readFile(fixture_path, 'utf8');
	const result = await update_changelog(
		'grogarden',
		'gro',
		fixture_path,
		token,
		log,
		changelog_cache_fixture,
	);
	const updated = await readFile(fixture_path, 'utf8');
	await writeFile(fixture_path, original, 'utf8');
	assert.ok(result);
	assert.is(updated, ''); // TODO BLOCK
});

test.run();
