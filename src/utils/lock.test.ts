import {test, t} from '../oki/oki.js';

import {createLock} from './lock.js';

test('createLock()', () => {
	const lock = createLock();
	const runLifecycle = (key: any) => {
		t.ok(!lock.has(key));
		t.ok(!lock.tryToRelease(key));
		t.ok(lock.tryToObtain(key));
		t.ok(lock.has(key));
		t.ok(lock.tryToObtain(key));
		t.ok(lock.has(key));
		t.ok(!lock.tryToObtain({}));
		t.ok(lock.tryToRelease(key));
		t.ok(!lock.has(key));
		t.ok(!lock.tryToRelease(key));
	};
	const key1 = {};
	test('lock lifecycle', () => {
		runLifecycle(key1);
	});
	test('lock lifecycle again', () => {
		runLifecycle(key1);
	});
	test('lock lifecycle again with a new key', () => {
		runLifecycle({});
	});
});
