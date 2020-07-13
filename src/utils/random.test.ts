import {test, t} from '../oki/oki.js';
import {randomFloat, randomInt, randomItem} from './random.js';

test('randomFloat()', () => {
	test('-5.5 to 7', () => {
		for (let i = 0; i < 20; i++) {
			const result = randomFloat(-5.5, 7);
			t.ok(result >= -5.5);
			t.ok(result < 7);
		}
	});
});

test('randomInt()', () => {
	test('0 to 1', () => {
		const items = [0, 1];
		const results = [];
		for (let i = 0; i < 20; i++) {
			const result = randomInt(0, 1);
			t.ok(items.includes(result));
			results.push(result);
		}
		for (const item of items) {
			t.ok(results.includes(item));
		}
	});
	test('1 to 5', () => {
		const items = [1, 2, 3, 4, 5];
		const results = [];
		for (let i = 0; i < 100; i++) {
			const result = randomInt(1, 5);
			t.ok(items.includes(result));
			results.push(result);
		}
		for (const item of items) {
			t.ok(results.includes(item));
		}
	});
	test('-3 to 2', () => {
		const items = [-3, -2, -1, 0, 1, 2];
		const results = [];
		for (let i = 0; i < 100; i++) {
			const result = randomInt(-3, 2);
			t.ok(items.includes(result));
			results.push(result);
		}
		for (const item of items) {
			t.ok(results.includes(item));
		}
	});
	test('2 to 2', () => {
		t.is(randomInt(2, 2), 2);
	});
});

test('randomItem()', () => {
	test('a and b', () => {
		const items = ['a', 'b'];
		const results = [];
		for (let i = 0; i < 20; i++) {
			const result = randomItem(items)!;
			t.ok(items.includes(result));
			results.push(result);
		}
		for (const item of items) {
			t.ok(results.includes(item));
		}
	});
	test('1 to 5', () => {
		const items = [1, 2, 3, 4, 5];
		const results = [];
		for (let i = 0; i < 100; i++) {
			const result = randomItem(items)!;
			t.ok(items.includes(result));
			results.push(result);
		}
		for (const item of items) {
			t.ok(results.includes(item));
		}
	});
	test('empty array', () => {
		t.is(randomItem([]), undefined);
	});
});
