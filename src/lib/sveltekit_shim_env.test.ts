import {test} from 'uvu';
import * as assert from 'uvu/assert';
import {resolve} from 'node:path';

const VALUE = 'SOME_PUBLIC_ENV_VAR';

test.before(async () => {
	(await import(resolve('../fixtures/test_helpers.ts'))).init_test_env();
});

test('shims static SvelteKit $env imports', async () => {
	const mod = await import(resolve('../fixtures/test_sveltekit_env.ts'));
	assert.is(mod.exported_env_static_public, VALUE);
});

test('shims dynamic SvelteKit $env imports', async () => {
	const mod = await import('$env/static/public');
	assert.is(mod.PUBLIC_SOME_PUBLIC_ENV_VAR, VALUE);
});

test.run();
