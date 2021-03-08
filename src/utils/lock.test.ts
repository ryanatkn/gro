import {test, t} from '../oki/oki.js';

import {createLock} from './lock.js';

test('createLock()', () => {
	const lock = createLock();
	const runLifecycle = (key: any) => {
		t.ok(!lock.has(key));
		t.ok(!lock.unlock(key));
		t.is(lock.peek(), null);
		t.ok(lock.lock(key));
		t.ok(lock.has(key));
		t.is(lock.peek(), key);
		t.ok(lock.lock(key));
		t.ok(lock.has(key));
		t.ok(!lock.lock({}));
		t.is(lock.peek(), key);
		t.ok(lock.unlock(key));
		t.ok(!lock.has(key));
		t.is(lock.peek(), null);
		t.ok(!lock.unlock(key));
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
