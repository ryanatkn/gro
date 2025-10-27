import {test, expect} from 'vitest';
import {Package_Json, Package_Json_Exports} from '@ryanatkn/belt/package_json.js';

import {
	load_package_json,
	parse_repo_url,
	serialize_package_json,
	to_package_exports,
} from '../lib/package_json.ts';

test('load_package_json', () => {
	const package_json = load_package_json();
	expect(package_json).toBeTruthy();
	const parsed = Package_Json.parse(package_json);
	expect(parsed).toBeTruthy();
	serialize_package_json(package_json);
});

test('load_package_json with cache', () => {
	const cache = {};
	const package_json1 = load_package_json(undefined, cache);
	expect(package_json1).toBeTruthy();
	expect(Object.keys(cache).length).toBe(1);
	const package_json2 = load_package_json(undefined, cache);
	expect(Object.keys(cache).length).toBe(1);
	expect(package_json1).toBe(package_json2);
});

test('Package_Json.parse', () => {
	Package_Json.parse({name: 'abc', version: '123'});
});

test('Package_Json.parse fails with bad data', () => {
	let err;
	try {
		Package_Json.parse({version: '123'});
	} catch (_err) {
		err = _err;
	}
	expect(err).toBeTruthy();
});

test('serialize_package_json', () => {
	serialize_package_json({name: 'abc', version: '123'});
});

test('serialize_package_json fails with bad data', () => {
	let err;
	try {
		serialize_package_json({version: '123'} as any);
	} catch (_err) {
		err = _err;
	}
	expect(err).toBeTruthy();
});

test('to_package_exports', () => {
	expect(to_package_exports(['a/b.ts'])).toEqual({
		'./package.json': './package.json',
		'./*.js': {
			default: './dist/*.js',
			types: './dist/*.d.ts',
		},
		'./*.ts': {
			default: './dist/*.js',
			types: './dist/*.d.ts',
		},
	});
	expect(to_package_exports(['*.svelte', '*.ts', '*.json', 'index.ts'])).toEqual({
		'.': {
			default: './dist/index.js',
			types: './dist/index.d.ts',
		},
		'./package.json': './package.json',
		'./*.json': {
			default: './dist/*.json',
			types: './dist/*.json.d.ts',
		},
		'./*.svelte': {
			svelte: './dist/*.svelte',
			default: './dist/*.svelte',
			types: './dist/*.svelte.d.ts',
		},
		'./*.js': {
			default: './dist/*.js',
			types: './dist/*.d.ts',
		},
		'./*.ts': {
			default: './dist/*.js',
			types: './dist/*.d.ts',
		},
	});
});

test('parse_repo_url', () => {
	const parsed = parse_repo_url(load_package_json());
	expect(parsed?.owner).toBe('ryanatkn');
	expect(parsed?.repo).toBe('gro');
});

test('`Package_Json_Exports` parses simple string exports', () => {
	const exports = {
		'.': './index.js',
		'./lib': './lib/index.js',
	};
	const parsed = Package_Json_Exports.safeParse(exports);
	expect(parsed.success).toBe(true);
	expect(exports).toEqual(parsed.data);
});

test('`Package_Json_Exports` parses null exports', () => {
	const exports = {
		'.': './index.js',
		'./internal/*': null,
	};
	const parsed = Package_Json_Exports.safeParse(exports);
	expect(parsed.success).toBe(true);
	expect(exports).toEqual(parsed.data);
});

test('`Package_Json_Exports` parses basic conditional exports', () => {
	const exports = {
		'.': {
			import: './index.mjs',
			require: './index.cjs',
			default: './index.js',
		},
	};
	const parsed = Package_Json_Exports.safeParse(exports);
	expect(parsed.success).toBe(true);
	expect(exports).toEqual(parsed.data);
});

test('`Package_Json_Exports` parses nested conditional exports', () => {
	const exports = {
		'./feature': {
			node: {
				import: './feature-node.mjs',
				require: './feature-node.cjs',
			},
			default: './feature.mjs',
		},
	};
	const parsed = Package_Json_Exports.safeParse(exports);
	expect(parsed.success).toBe(true);
	expect(exports).toEqual(parsed.data);
});

test('`Package_Json_Exports` parses deeply nested conditional exports', () => {
	const exports = {
		'./advanced': {
			node: {
				development: {
					import: './dev-node.mjs',
					require: './dev-node.cjs',
				},
				production: {
					import: './prod-node.mjs',
					require: './prod-node.cjs',
				},
			},
			default: './feature.mjs',
		},
	};
	const parsed = Package_Json_Exports.safeParse(exports);
	expect(parsed.success).toBe(true);
	expect(exports).toEqual(parsed.data);
});

test('`Package_Json_Exports` parses mixed exports types', () => {
	const exports = {
		'.': './index.js',
		'./lib': {
			node: './lib/node.js',
			default: './lib/index.js',
		},
		'./feature/*': null,
		'./advanced': {
			node: {
				import: './advanced-node.mjs',
				require: './advanced-node.cjs',
			},
		},
	};
	const parsed = Package_Json_Exports.safeParse(exports);
	expect(parsed.success).toBe(true);
	expect(exports).toEqual(parsed.data);
});

test('rejects invalid exports', () => {
	const invalid_exports = [
		{
			'.': true, // boolean is not a valid export value
		},
		{
			'.': ['/path'], // array is not a valid export value
		},
		{
			'.': {
				default: true, // boolean is not a valid export value in conditions
			},
		},
		{
			'.': {
				node: {
					import: ['/path'], // array is not a valid nested export value
				},
			},
		},
	];

	for (const invalid_export of invalid_exports) {
		const parsed = Package_Json_Exports.safeParse(invalid_export);
		expect(parsed.success).toBe(false);
	}
});
