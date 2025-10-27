import {describe, test, expect} from 'vitest';

import {to_deterministic_json} from './json_helpers.ts';

describe('to_deterministic_json', () => {
	test('sorts object keys alphabetically', () => {
		const obj = {z: 1, a: 2, m: 3};
		const result = to_deterministic_json(obj);
		expect(result).toBe('{"a":2,"m":3,"z":1}');
	});

	test('produces same output regardless of key order', () => {
		const obj1 = {z: 1, a: 2, m: 3};
		const obj2 = {a: 2, m: 3, z: 1};
		const obj3 = {m: 3, z: 1, a: 2};

		expect(to_deterministic_json(obj1)).toBe(to_deterministic_json(obj2));
		expect(to_deterministic_json(obj2)).toBe(to_deterministic_json(obj3));
	});

	test('handles nested objects', () => {
		const obj = {
			z: {nested_z: 1, nested_a: 2},
			a: {nested_b: 3, nested_a: 4},
		};
		const result = to_deterministic_json(obj);
		// Both outer and inner keys should be sorted
		expect(result).toBe('{"a":{"nested_a":4,"nested_b":3},"z":{"nested_a":2,"nested_z":1}}');
	});

	test('preserves array order', () => {
		const obj = {z: [3, 1, 2], a: [6, 4, 5]};
		const result = to_deterministic_json(obj);
		// Keys sorted, but array elements keep their order
		expect(result).toBe('{"a":[6,4,5],"z":[3,1,2]}');
	});

	test('handles arrays of objects', () => {
		const obj = {
			items: [
				{z: 1, a: 2},
				{y: 3, b: 4},
			],
		};
		const result = to_deterministic_json(obj);
		// Objects in array should also have sorted keys
		expect(result).toBe('{"items":[{"a":2,"z":1},{"b":4,"y":3}]}');
	});

	test('handles primitives', () => {
		expect(to_deterministic_json('string')).toBe('"string"');
		expect(to_deterministic_json(123)).toBe('123');
		expect(to_deterministic_json(true)).toBe('true');
		expect(to_deterministic_json(null)).toBe('null');
	});

	test('handles undefined in objects by omitting keys', () => {
		const obj = {z: 1, a: undefined, m: 2};
		const result = to_deterministic_json(obj);
		// 'a' key is omitted entirely
		expect(result).toBe('{"m":2,"z":1}');
	});

	test('handles undefined in arrays by converting to null', () => {
		const obj = {items: [1, undefined, 3]};
		const result = to_deterministic_json(obj);
		// undefined becomes null in arrays
		expect(result).toBe('{"items":[1,null,3]}');
	});

	test('handles NaN and Infinity as null', () => {
		const obj = {z_nan: NaN, a_inf: Infinity, m_neginf: -Infinity};
		const result = to_deterministic_json(obj);
		expect(result).toBe('{"a_inf":null,"m_neginf":null,"z_nan":null}');
	});

	test('handles functions by omitting them from objects', () => {
		const obj = {z: 1, a: () => 'test', m: 2};
		const result = to_deterministic_json(obj);
		// Function key is omitted
		expect(result).toBe('{"m":2,"z":1}');
	});

	test('handles Date objects as ISO strings', () => {
		const date = new Date('2024-01-15T12:00:00.000Z');
		const obj = {z_date: date, a_string: 'text'};
		const result = to_deterministic_json(obj);
		expect(result).toBe('{"a_string":"text","z_date":"2024-01-15T12:00:00.000Z"}');
	});

	test('handles empty object', () => {
		expect(to_deterministic_json({})).toBe('{}');
	});

	test('handles empty array', () => {
		expect(to_deterministic_json([])).toBe('[]');
	});

	test('sorts numeric keys alphabetically as strings', () => {
		const obj = {10: 'ten', 2: 'two', 1: 'one', 20: 'twenty'};
		const result = to_deterministic_json(obj);
		// JSON.stringify outputs integer-like keys in numeric order per spec
		expect(result).toBe('{"1":"one","2":"two","10":"ten","20":"twenty"}');
	});

	test('handles empty string keys', () => {
		const obj = {'': 'empty', z: 'z-value', a: 'a-value'};
		const result = to_deterministic_json(obj);
		// Empty string sorts first
		expect(result).toBe('{"":"empty","a":"a-value","z":"z-value"}');
	});

	test('handles Unicode and special characters in keys', () => {
		const obj = {'z-key': 1, 'a key': 2, 'ñ': 3, '中文': 4};
		const result = to_deterministic_json(obj);
		// Sorts by Unicode code points
		expect(result).toBe('{"a key":2,"z-key":1,"ñ":3,"中文":4}');
	});

	test('handles deeply nested structures', () => {
		const obj = {
			z: {
				nested: {
					deep: {
						z_key: 1,
						a_key: 2,
					},
				},
			},
			a: 'value',
		};
		const result = to_deterministic_json(obj);
		expect(result).toBe('{"a":"value","z":{"nested":{"deep":{"a_key":2,"z_key":1}}}}');
	});

	test('handles objects with toJSON method', () => {
		const obj = {
			z: 'regular',
			a: {
				toJSON() {
					return {custom: 'serialized', z_field: 1, a_field: 2};
				},
			},
		};
		const result = to_deterministic_json(obj);
		// toJSON output also gets sorted
		expect(result).toBe('{"a":{"a_field":2,"custom":"serialized","z_field":1},"z":"regular"}');
	});

	test('handles mixed types', () => {
		const obj = {
			z_string: 'text',
			a_number: 42,
			m_boolean: true,
			b_null: null,
			y_array: [1, 2, 3],
			d_object: {z: 1, a: 2},
		};
		const result = to_deterministic_json(obj);
		expect(result).toBe(
			'{"a_number":42,"b_null":null,"d_object":{"a":2,"z":1},"m_boolean":true,"y_array":[1,2,3],"z_string":"text"}',
		);
	});

	test('consistent with JSON.parse roundtrip', () => {
		const obj = {z: 1, a: 2, m: {nested_z: 3, nested_a: 4}};
		const json = to_deterministic_json(obj);
		const parsed = JSON.parse(json);
		// The parsed object should be semantically equal (though key order might differ in memory)
		expect(parsed).toEqual(obj);
	});

	test('throws on circular references', () => {
		const obj: any = {z: 1, a: 2};
		obj.circular = obj;
		// Throws RangeError (stack overflow) due to recursion in replacer
		expect(() => to_deterministic_json(obj)).toThrow(RangeError);
	});

	test('handles build_cache_config-like objects', () => {
		const config1 = {
			platform: 'linux',
			arch: 'x64',
			node: 'v20.0.0',
			features: {beta_ui: true, analytics: false},
		};
		const config2 = {
			features: {analytics: false, beta_ui: true},
			node: 'v20.0.0',
			platform: 'linux',
			arch: 'x64',
		};

		expect(to_deterministic_json(config1)).toBe(to_deterministic_json(config2));
	});
});
