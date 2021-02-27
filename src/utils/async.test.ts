import {test, t} from '../oki/oki.js';
import {wait, wrap} from './async.js';

test('wait()', async () => {
	await wait();
	await wait(10);
});

test('wrap()', async () => {
	let v = 'start';
	await wrap(async (after) => {
		t.is(v, 'start');
		after(async () => {
			await wait();
			v = 'after1';
		});
		after(() => t.is(v, 'after1'));
		after(async () => {
			await wait();
			v = 'after2';
		});
		after(() => t.is(v, 'after2'));
		after(async () => {
			await wait();
			v = 'after3';
		});
		after(() => t.is(v, 'after3'));
		t.is(v, 'start');
	});
	t.is(v, 'after3');
});
