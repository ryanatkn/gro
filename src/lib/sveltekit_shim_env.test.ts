import {test} from 'uvu';
import * as assert from 'uvu/assert';

import {init_test_env} from '../fixtures/test_helpers.ts';

const VALUE = 'SOME_PUBLIC_ENV_VAR';

init_test_env();

test('shims static SvelteKit $env imports', async () => {
	const mod = await import('../fixtures/test_sveltekit_env.ts');
	assert.is(mod.exported_env_static_public, VALUE);
});

test('shims dynamic SvelteKit $env imports', async () => {
	const mod = await import('$env/static/public');
	assert.is(mod.PUBLIC_SOME_PUBLIC_ENV_VAR, VALUE);
});

test.run();
