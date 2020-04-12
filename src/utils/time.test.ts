import {test, t} from '../oki/oki.js';
import {createStopwatch, Timings} from './time.js';

test('createStopwatch', () => {
	const stopwatch = createStopwatch(4);
	const elapsed = stopwatch();
	t.is(typeof elapsed, 'number');
	t.ok(elapsed.toString().split('.')[1].length <= 4);
});

test('Timings', () => {
	const timings = new Timings(4);
	timings.start('foo');
	t.throws(() => timings.start('foo'));
	timings.stop('foo');
	t.throws(() => timings.stop('foo'));
	t.throws(() => timings.stop('bar'));
	const elapsed = timings.get('foo');
	t.is(typeof elapsed, 'number');
	t.throws(() => timings.get('bar'));
	t.ok(elapsed.toString().split('.')[1].length <= 4);
});
