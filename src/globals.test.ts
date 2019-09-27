import {test} from './oki/index.js';
import {createGlobalRef} from './globals.js';

test('createGlobalRef', t => {
	const value = {a: 1};
	const ref = createGlobalRef<typeof value>('foo');
	t.throws(() => ref.get());
	t.throws(() => ref.delete(value));
	t.notOk(ref.exists());
	ref.set(value);
	t.ok(ref.exists());
	t.is(ref.get(), value);
	t.throws(() => ref.set(value));
	t.throws(() => ref.set({a: 1}));
	t.throws(() => ref.delete({a: 1}));
	ref.delete(value);
	t.throws(() => ref.delete(value));
	t.notOk(ref.exists());
});
