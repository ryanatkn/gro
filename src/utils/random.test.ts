import {test} from '../oki/index.js';
import {randInt, randItem} from './random.js';

// TODO maybe add to oki an assertion for `t.has` or `t.includes`?
// TODO maybe track counts to ensure a roughly equal distribution? (with some statistical confidence interval so we don't get failing tests except in extreme cases)

test('randInt', t => {
	test('0 to 1', () => {
		const items = [0, 1];
		const results = [];
		for (let i = 0; i < 20; i++) {
			const result = randInt(0, 1);
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
			const result = randInt(1, 5);
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
			const result = randInt(-3, 2);
			t.ok(items.includes(result));
			results.push(result);
		}
		for (const item of items) {
			t.ok(results.includes(item));
		}
	});
	test('2 to 2', () => {
		t.is(randInt(2, 2), 2);
	});
});

test('randItem', t => {
	test('a and b', () => {
		const items = ['a', 'b'];
		const results = [];
		for (let i = 0; i < 20; i++) {
			const result = randItem(items)!;
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
			const result = randItem(items)!;
			t.ok(items.includes(result));
			results.push(result);
		}
		for (const item of items) {
			t.ok(results.includes(item));
		}
	});
	test('empty array', () => {
		t.is(randItem([]), undefined);
	});
});
