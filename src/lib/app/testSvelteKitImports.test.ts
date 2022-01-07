import {test} from 'uvu';

import {goto} from './testSvelteKitImports.js';

// see this issue: https://github.com/sveltejs/kit/issues/1485

test('testSvelteKitImports', () => {
	goto('');
});

test.run();
