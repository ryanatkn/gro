import {test} from 'uvu';
import * as assert from 'uvu/assert';

import {
	amp,
	browser,
	dev,
	mode,
	prerendering,
	goto,
	invalidate,
	prefetch,
	prefetchRoutes,
	assets,
	base,
	getStores,
	navigating,
	page,
	session,
} from './testSvelteKitImports';

// see this issue: https://github.com/sveltejs/kit/issues/1485

test('testSvelteKitImports', async () => {
	assert.not.ok(amp);
	assert.not.ok(browser);
	assert.ok(dev);
	assert.is(mode, 'development');
	assert.not.ok(prerendering);

	await goto('');
	assert.ok(invalidate(''));
	assert.ok(prefetch(''));
	assert.ok(prefetchRoutes());

	assert.type(assets, 'string');
	assert.type(base, 'string');

	const stores = getStores();
	assert.is(stores.navigating, navigating);
	assert.is(stores.page, page);
	assert.is(stores.session, session);
	assert.ok(navigating.subscribe);
	assert.ok(page.subscribe);
	assert.ok(session.subscribe);
	assert.ok(session.set);
});

test.run();
