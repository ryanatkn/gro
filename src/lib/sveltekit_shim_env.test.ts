import {test} from 'uvu';
import * as assert from 'uvu/assert';
import {resolve} from 'node:path';
import {init_test_env} from './test_helpers.ts';

init_test_env();

const VALUE = 'SOME_PUBLIC_ENV_VAR';

// dynamic import paths are needed to avoid building .d.ts and .d.ts.map files, could be fixed in the build process

test('shims static SvelteKit $env imports', async () => {
	const mod = await import(resolve('src/fixtures/test_sveltekit_env.ts'));
	assert.is(mod.exported_env_static_public, VALUE);
});

test('shims dynamic SvelteKit $env imports', async () => {
	const mod = await import('$env/static/public');
	// @ts-ignore
	assert.is(mod.PUBLIC_SOME_PUBLIC_ENV_VAR, VALUE);
});

test.run();
