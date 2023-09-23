import {suite} from 'uvu';
import * as assert from 'uvu/assert';
import {resolve} from 'node:path';

import {to_gen_result} from './gen.js';

const origin_id = resolve('src/foo.gen.ts');

/* test__to_gen_result */
const test__to_gen_result = suite('to_gen_result');

test__to_gen_result('plain string', () => {
	assert.equal(to_gen_result(origin_id, '/**/'), {
		origin_id,
		files: [{id: resolve('src/foo.ts'), content: '/**/', origin_id, format: true}],
	});
});

test__to_gen_result('object with a content string', () => {
	assert.equal(to_gen_result(origin_id, {content: '/**/'}), {
		origin_id,
		files: [{id: resolve('src/foo.ts'), content: '/**/', origin_id, format: true}],
	});
});

test__to_gen_result('fail with an unresolved id', () => {
	assert.throws(() => to_gen_result('src/foo.ts', {content: '/**/'}));
});

test__to_gen_result('fail with a build id', () => {
	assert.throws(() => to_gen_result(resolve('.gro/foo.js'), {content: '/**/'}));
});

test__to_gen_result('fail with an empty id', () => {
	assert.throws(() => to_gen_result('', {content: '/**/'}));
});

test__to_gen_result('custom file name', () => {
	assert.equal(
		to_gen_result(origin_id, {
			filename: 'fooz.ts',
			content: '/**/',
		}),
		{
			origin_id,
			files: [{id: resolve('src/fooz.ts'), content: '/**/', origin_id, format: true}],
		},
	);
});

test__to_gen_result('custom file name that matches the default file name', () => {
	assert.equal(
		to_gen_result(origin_id, {
			filename: 'foo.ts',
			content: '/**/',
		}),
		{
			origin_id,
			files: [{id: resolve('src/foo.ts'), content: '/**/', origin_id, format: true}],
		},
	);
});

test__to_gen_result('fail when custom file name explicitly matches the origin', () => {
	assert.throws(() => {
		to_gen_result(origin_id, {
			filename: 'foo.gen.ts',
			content: '/**/',
		});
	});
});

test__to_gen_result('fail when file name implicitly matches the origin', () => {
	assert.throws(() => {
		to_gen_result(resolve('src/foo.ts'), {content: '/**/'});
	});
});

test__to_gen_result('fail with an empty file name', () => {
	assert.throws(() => to_gen_result(origin_id, {filename: '', content: '/**/'}));
});

test__to_gen_result('additional file name parts', () => {
	assert.equal(to_gen_result(resolve('src/foo.bar.gen.ts'), {content: '/**/'}), {
		origin_id: resolve('src/foo.bar.gen.ts'),
		files: [
			{
				id: resolve('src/foo.bar.ts'),
				content: '/**/',
				origin_id: resolve('src/foo.bar.gen.ts'),
				format: true,
			},
		],
	});
});

test__to_gen_result('js', () => {
	assert.equal(
		to_gen_result(origin_id, {
			filename: 'foo.js',
			content: '/**/',
		}),
		{
			origin_id,
			files: [{id: resolve('src/foo.js'), content: '/**/', origin_id, format: true}],
		},
	);
});

test__to_gen_result('implicit custom file extension', () => {
	assert.equal(to_gen_result(resolve('src/foo.gen.json.ts'), '[/**/]'), {
		origin_id: resolve('src/foo.gen.json.ts'),
		files: [
			{
				id: resolve('src/foo.json'),
				content: '[/**/]',
				origin_id: resolve('src/foo.gen.json.ts'),
				format: true,
			},
		],
	});
});

test__to_gen_result('implicit empty file extension', () => {
	assert.equal(to_gen_result(resolve('src/foo.gen..ts'), '[/**/]'), {
		origin_id: resolve('src/foo.gen..ts'),
		files: [
			{
				id: resolve('src/foo'),
				content: '[/**/]',
				origin_id: resolve('src/foo.gen..ts'),
				format: true,
			},
		],
	});
});

test__to_gen_result('implicit custom file extension with additional file name parts', () => {
	assert.equal(to_gen_result(resolve('src/foo.bar.gen.json.ts'), {content: '[/**/]'}), {
		origin_id: resolve('src/foo.bar.gen.json.ts'),
		files: [
			{
				id: resolve('src/foo.bar.json'),
				content: '[/**/]',
				origin_id: resolve('src/foo.bar.gen.json.ts'),
				format: true,
			},
		],
	});
});

test__to_gen_result('implicit custom file extension with many dots in between', () => {
	assert.equal(to_gen_result(resolve('src/foo...gen.ts'), '[/**/]'), {
		origin_id: resolve('src/foo...gen.ts'),
		files: [
			{
				id: resolve('src/foo...ts'),
				content: '[/**/]',
				origin_id: resolve('src/foo...gen.ts'),
				format: true,
			},
		],
	});
});

test__to_gen_result('fail with two parts following the .gen. pattern in the file name', () => {
	// This just ensures consistent file names - maybe loosen the restriction?
	// You can still implicitly name files like this,
	// but you have to move ".bar" before ".gen".
	assert.throws(() => to_gen_result(resolve('src/foo.gen.bar.json.ts'), '/**/'));
});

test__to_gen_result('fail implicit file extension ending with a dot', () => {
	// This just ensures consistent file names - maybe loosen the restriction?
	// This one is more restrictive than the above,
	// because to have a file ending with a dot
	// you have to use an explicit file name.
	assert.throws(() => to_gen_result(resolve('src/foo.gen...ts'), '[/**/]'));
});

test__to_gen_result('fail without a .gen. pattern in the file name', () => {
	assert.throws(() => {
		to_gen_result(resolve('src/foo.ts'), '/**/');
	});
});

test__to_gen_result(
	'fail without a .gen. pattern in a file name that has multiple other patterns',
	() => {
		assert.throws(() => {
			to_gen_result(resolve('src/foo.bar.baz.ts'), '/**/');
		});
	},
);

test__to_gen_result('fail with two .gen. patterns in the file name', () => {
	assert.throws(() => to_gen_result(resolve('src/lib/gen.gen.ts'), '/**/'));
	assert.throws(() => to_gen_result(resolve('src/foo.gen.gen.ts'), '/**/'));
	assert.throws(() => to_gen_result(resolve('src/foo.gen.bar.gen.ts'), '/**/'));
	assert.throws(() => to_gen_result(resolve('src/foo.gen.bar.gen.baz.ts'), '/**/'));
});

test__to_gen_result('explicit custom file extension', () => {
	assert.equal(
		to_gen_result(origin_id, {
			filename: 'foo.json',
			content: '[/**/]',
		}),
		{
			origin_id,
			files: [{id: resolve('src/foo.json'), content: '[/**/]', origin_id, format: true}],
		},
	);
});

test__to_gen_result('explicit custom empty file extension', () => {
	assert.equal(
		to_gen_result(origin_id, {
			filename: 'foo',
			content: '[/**/]',
		}),
		{
			origin_id,
			files: [{id: resolve('src/foo'), content: '[/**/]', origin_id, format: true}],
		},
	);
});

test__to_gen_result('explicit custom file extension ending with a dot', () => {
	assert.equal(
		to_gen_result(origin_id, {
			filename: 'foo.',
			content: '[/**/]',
		}),
		{
			origin_id,
			files: [{id: resolve('src/foo.'), content: '[/**/]', origin_id, format: true}],
		},
	);
});

test__to_gen_result('simple array of raw files', () => {
	assert.equal(
		to_gen_result(origin_id, [{content: '/*1*/'}, {filename: 'foo2.ts', content: '/*2*/'}]),
		{
			origin_id,
			files: [
				{id: resolve('src/foo.ts'), content: '/*1*/', origin_id, format: true},
				{id: resolve('src/foo2.ts'), content: '/*2*/', origin_id, format: true},
			],
		},
	);
});

test__to_gen_result('complex array of raw files', () => {
	assert.equal(
		to_gen_result(origin_id, [
			{content: '/*1*/'},
			{filename: 'foo2.ts', content: '/*2*/'},
			{filename: 'foo3.ts', content: '/*3*/'},
			{filename: 'foo4.ts', content: '/*4*/'},
			{filename: 'foo5.json', content: '[/*5*/]'},
		]),
		{
			origin_id,
			files: [
				{id: resolve('src/foo.ts'), content: '/*1*/', origin_id, format: true},
				{id: resolve('src/foo2.ts'), content: '/*2*/', origin_id, format: true},
				{id: resolve('src/foo3.ts'), content: '/*3*/', origin_id, format: true},
				{id: resolve('src/foo4.ts'), content: '/*4*/', origin_id, format: true},
				{id: resolve('src/foo5.json'), content: '[/*5*/]', origin_id, format: true},
			],
		},
	);
});

test__to_gen_result('fail with duplicate names because of omissions', () => {
	assert.throws(() => {
		to_gen_result(origin_id, [{content: '/*1*/'}, {content: '/*2*/'}]);
	});
});

test__to_gen_result('fail with duplicate explicit names', () => {
	assert.throws(() => {
		to_gen_result(origin_id, [
			{filename: 'foo.ts', content: '/*1*/'},
			{filename: 'foo.ts', content: '/*2*/'},
		]);
	});
});

test__to_gen_result('fail with duplicate explicit and implicit names', () => {
	assert.throws(() => {
		to_gen_result(origin_id, [{content: '/*1*/'}, {filename: 'foo.ts', content: '/*2*/'}]);
	});
});

test__to_gen_result.run();
/* test__to_gen_result */
