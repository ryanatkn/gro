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

const fixture_path = 'src/fixtures/changelog_example.md';

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
	assert.is(
		updated,
		`# @grogarden/gro

## 0.6.0

### Minor Changes

- duplicate 1 ([#429](https://github.com/grogarden/gro/pull/429))
- duplicate 2 ([#429](https://github.com/grogarden/gro/pull/429))
- abc ([#437](https://github.com/grogarden/gro/pull/437))

  - 123
  - 123
  - 123

### Patch Changes

- abc ([5e94cd4](https://github.com/grogarden/gro/commit/5e94cd4))

## 0.5.2

### Patch Changes

- abc ([e345eaa](https://github.com/grogarden/gro/commit/e345eaa))

## 0.5.1

### Patch Changes

- abc ([094279d](https://github.com/grogarden/gro/commit/094279d))

## 0.5.0

### Minor Changes

- abc ([f6133f7](https://github.com/grogarden/gro/commit/f6133f7))

## 0.4.3

### Patch Changes

- abc ([54b65ec](https://github.com/grogarden/gro/commit/54b65ec))

## 0.4.2

### Patch Changes

- abc ([80365d0](https://github.com/grogarden/gro/commit/80365d0))

## 0.4.1

### Patch Changes

- abc ([3d84dfd](https://github.com/grogarden/gro/commit/3d84dfd))
- abc ([fc64b77](https://github.com/grogarden/gro/commit/fc64b77))

## 0.4.0

### Minor Changes

- abc ([#434](https://github.com/grogarden/gro/pull/434))
  - 123
  - 123

### Patch Changes

- abc ([#434](https://github.com/grogarden/gro/pull/434))

## 0.3.1

- e

## 0.3.0

- b2
- c2
- d2

## 0.2.0

- a2

## 0.1.2

- e

## 0.1.1

- b
- c
- d

## 0.1.0

- a
`,
	);
});

test.run();
