import {test, t} from '../oki/oki.js';
import {createStopwatch, Timings} from './time.js';

test('createStopwatch', () => {
	const stopwatch = createStopwatch(4);
	const elapsed = stopwatch();
	t.is(typeof elapsed, 'number');
	t.ok(elapsed.toString().split('.')[1].length <= 4);
});

test('Timings', () => {
	test('start and stop', () => {
		const timings = new Timings<'foo' | 'bar'>(4);
		timings.start('foo');
		t.throws(() => timings.start('foo'));
		t.ok(typeof timings.stop('foo') === 'number');
		t.throws(() => timings.stop('foo'));
		t.throws(() => timings.stop('bar'));
		const elapsed = timings.get('foo');
		t.is(typeof elapsed, 'number');
		t.throws(() => timings.get('bar'));
		t.ok(elapsed.toString().split('.')[1].length <= 4);
	});

	test('start with stop callback', () => {
		const timings = new Timings<'foo'>(4);
		const timingToFoo = timings.start('foo');
		const elapsed = timingToFoo();
		t.is(typeof elapsed, 'number');
		t.ok(elapsed.toString().split('.')[1].length <= 4);
		t.throws(() => timingToFoo());
		t.throws(() => timings.stop('foo'));
		t.is(elapsed, timings.get('foo'));
	});

	test('merge timings', () => {
		const a = new Timings(10);
		const b = new Timings(10);
		a.start('test');
		const aTiming = a.stop('test');
		t.ok(aTiming);
		b.start('test');
		const bTiming = b.stop('test');
		t.ok(bTiming);
		a.merge(b);
		t.is(a.get('test'), aTiming + bTiming);
		t.is(b.get('test'), bTiming);
	});

	// TODO TypeScript 3.9 @ts-expect-error
	// timings.start('no');
});
