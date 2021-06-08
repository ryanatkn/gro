import {suite} from 'uvu';
import * as t from 'uvu/assert';
import {resolve} from 'path';

import {to_gen_result} from './gen.js';

const origin_id = resolve('src/foo.gen.ts');

/* test_to_gen_result */
const test_to_gen_result = suite('to_gen_result');

test_to_gen_result('plain string', () => {
	t.equal(to_gen_result(origin_id, '/**/'), {
		origin_id,
		files: [{id: resolve('src/foo.ts'), contents: '/**/', origin_id}],
	});
});

test_to_gen_result('object with a contents string', () => {
	t.equal(to_gen_result(origin_id, {contents: '/**/'}), {
		origin_id,
		files: [{id: resolve('src/foo.ts'), contents: '/**/', origin_id}],
	});
});

test_to_gen_result('fail with an unresolved id', () => {
	t.throws(() => to_gen_result('src/foo.ts', {contents: '/**/'}));
});

test_to_gen_result('fail with a build id', () => {
	t.throws(() => to_gen_result(resolve('.gro/foo.js'), {contents: '/**/'}));
});

test_to_gen_result('fail with an empty id', () => {
	t.throws(() => to_gen_result('', {contents: '/**/'}));
});

test_to_gen_result('custom file name', () => {
	t.equal(
		to_gen_result(origin_id, {
			filename: 'fooz.ts',
			contents: '/**/',
		}),
		{
			origin_id,
			files: [{id: resolve('src/fooz.ts'), contents: '/**/', origin_id}],
		},
	);
});

test_to_gen_result('custom file name that matches the default file name', () => {
	t.equal(
		to_gen_result(origin_id, {
			filename: 'foo.ts',
			contents: '/**/',
		}),
		{
			origin_id,
			files: [{id: resolve('src/foo.ts'), contents: '/**/', origin_id}],
		},
	);
});

test_to_gen_result('fail when custom file name explicitly matches the origin', () => {
	t.throws(() => {
		to_gen_result(origin_id, {
			filename: 'foo.gen.ts',
			contents: '/**/',
		});
	});
});

test_to_gen_result('fail when file name implicitly matches the origin', () => {
	t.throws(() => {
		to_gen_result(resolve('src/foo.ts'), {contents: '/**/'});
	});
});

test_to_gen_result('fail with an empty file name', () => {
	t.throws(() => to_gen_result(origin_id, {filename: '', contents: '/**/'}));
});

test_to_gen_result('additional file name parts', () => {
	t.equal(to_gen_result(resolve('src/foo.bar.gen.ts'), {contents: '/**/'}), {
		origin_id: resolve('src/foo.bar.gen.ts'),
		files: [
			{
				id: resolve('src/foo.bar.ts'),
				contents: '/**/',
				origin_id: resolve('src/foo.bar.gen.ts'),
			},
		],
	});
});

test_to_gen_result('js', () => {
	t.equal(
		to_gen_result(origin_id, {
			filename: 'foo.js',
			contents: '/**/',
		}),
		{
			origin_id,
			files: [{id: resolve('src/foo.js'), contents: '/**/', origin_id}],
		},
	);
});

test_to_gen_result('implicit custom file extension', () => {
	t.equal(to_gen_result(resolve('src/foo.gen.json.ts'), '[/**/]'), {
		origin_id: resolve('src/foo.gen.json.ts'),
		files: [
			{
				id: resolve('src/foo.json'),
				contents: '[/**/]',
				origin_id: resolve('src/foo.gen.json.ts'),
			},
		],
	});
});

test_to_gen_result('implicit empty file extension', () => {
	t.equal(to_gen_result(resolve('src/foo.gen..ts'), '[/**/]'), {
		origin_id: resolve('src/foo.gen..ts'),
		files: [
			{
				id: resolve('src/foo'),
				contents: '[/**/]',
				origin_id: resolve('src/foo.gen..ts'),
			},
		],
	});
});

test_to_gen_result('implicit custom file extension with additional file name parts', () => {
	t.equal(to_gen_result(resolve('src/foo.bar.gen.json.ts'), {contents: '[/**/]'}), {
		origin_id: resolve('src/foo.bar.gen.json.ts'),
		files: [
			{
				id: resolve('src/foo.bar.json'),
				contents: '[/**/]',
				origin_id: resolve('src/foo.bar.gen.json.ts'),
			},
		],
	});
});

test_to_gen_result('implicit custom file extension with many dots in between', () => {
	t.equal(to_gen_result(resolve('src/foo...gen.ts'), '[/**/]'), {
		origin_id: resolve('src/foo...gen.ts'),
		files: [
			{
				id: resolve('src/foo...ts'),
				contents: '[/**/]',
				origin_id: resolve('src/foo...gen.ts'),
			},
		],
	});
});

test_to_gen_result('fail with two parts following the .gen. pattern in the file name', () => {
	// This just ensures consistent file names - maybe loosen the restriction?
	// You can still implicitly name files like this,
	// but you have to move ".bar" before ".gen".
	t.throws(() => to_gen_result(resolve('src/foo.gen.bar.json.ts'), '/**/'));
});

test_to_gen_result('fail implicit file extension ending with a dot', () => {
	// This just ensures consistent file names - maybe loosen the restriction?
	// This one is more restrictive than the above,
	// because to have a file ending with a dot
	// you have to use an explicit file name.
	t.throws(() => to_gen_result(resolve('src/foo.gen...ts'), '[/**/]'));
});

test_to_gen_result('fail without a .gen. pattern in the file name', () => {
	t.throws(() => {
		to_gen_result(resolve('src/foo.ts'), '/**/');
	});
});

test_to_gen_result(
	'fail without a .gen. pattern in a file name that has multiple other patterns',
	() => {
		t.throws(() => {
			to_gen_result(resolve('src/foo.bar.baz.ts'), '/**/');
		});
	},
);

test_to_gen_result('fail with two .gen. patterns in the file name', () => {
	t.throws(() => to_gen_result(resolve('src/gen.gen.ts'), '/**/'));
	t.throws(() => to_gen_result(resolve('src/foo.gen.gen.ts'), '/**/'));
	t.throws(() => to_gen_result(resolve('src/foo.gen.bar.gen.ts'), '/**/'));
	t.throws(() => to_gen_result(resolve('src/foo.gen.bar.gen.baz.ts'), '/**/'));
});

test_to_gen_result('explicit custom file extension', () => {
	t.equal(
		to_gen_result(origin_id, {
			filename: 'foo.json',
			contents: '[/**/]',
		}),
		{
			origin_id,
			files: [{id: resolve('src/foo.json'), contents: '[/**/]', origin_id}],
		},
	);
});

test_to_gen_result('explicit custom empty file extension', () => {
	t.equal(
		to_gen_result(origin_id, {
			filename: 'foo',
			contents: '[/**/]',
		}),
		{
			origin_id,
			files: [{id: resolve('src/foo'), contents: '[/**/]', origin_id}],
		},
	);
});

test_to_gen_result('explicit custom file extension ending with a dot', () => {
	t.equal(
		to_gen_result(origin_id, {
			filename: 'foo.',
			contents: '[/**/]',
		}),
		{
			origin_id,
			files: [{id: resolve('src/foo.'), contents: '[/**/]', origin_id}],
		},
	);
});

test_to_gen_result('simple array of raw files', () => {
	t.equal(
		to_gen_result(origin_id, [{contents: '/*1*/'}, {filename: 'foo2.ts', contents: '/*2*/'}]),
		{
			origin_id,
			files: [
				{id: resolve('src/foo.ts'), contents: '/*1*/', origin_id},
				{id: resolve('src/foo2.ts'), contents: '/*2*/', origin_id},
			],
		},
	);
});

test_to_gen_result('complex array of raw files', () => {
	t.equal(
		to_gen_result(origin_id, [
			{contents: '/*1*/'},
			{filename: 'foo2.ts', contents: '/*2*/'},
			{filename: 'foo3.ts', contents: '/*3*/'},
			{filename: 'foo4.ts', contents: '/*4*/'},
			{filename: 'foo5.json', contents: '[/*5*/]'},
		]),
		{
			origin_id,
			files: [
				{id: resolve('src/foo.ts'), contents: '/*1*/', origin_id},
				{id: resolve('src/foo2.ts'), contents: '/*2*/', origin_id},
				{id: resolve('src/foo3.ts'), contents: '/*3*/', origin_id},
				{id: resolve('src/foo4.ts'), contents: '/*4*/', origin_id},
				{id: resolve('src/foo5.json'), contents: '[/*5*/]', origin_id},
			],
		},
	);
});

test_to_gen_result('fail with duplicate names because of omissions', () => {
	t.throws(() => {
		to_gen_result(origin_id, [{contents: '/*1*/'}, {contents: '/*2*/'}]);
	});
});

test_to_gen_result('fail with duplicate explicit names', () => {
	t.throws(() => {
		to_gen_result(origin_id, [
			{filename: 'foo.ts', contents: '/*1*/'},
			{filename: 'foo.ts', contents: '/*2*/'},
		]);
	});
});

test_to_gen_result('fail with duplicate explicit and implicit names', () => {
	t.throws(() => {
		to_gen_result(origin_id, [{contents: '/*1*/'}, {filename: 'foo.ts', contents: '/*2*/'}]);
	});
});

test_to_gen_result.run();
/* /test_to_gen_result */
