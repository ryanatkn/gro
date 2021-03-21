import {suite} from 'uvu';
import * as t from 'uvu/assert';
import {resolve} from 'path';

import {toGenResult} from './gen.js';

const originId = resolve('src/foo.gen.ts');

/* test_toGenResult */
const test_toGenResult = suite('toGenResult');

test_toGenResult('plain string', () => {
	t.equal(toGenResult(originId, '/**/'), {
		originId,
		files: [{id: resolve('src/foo.ts'), contents: '/**/', originId}],
	});
});

test_toGenResult('object with a contents string', () => {
	t.equal(toGenResult(originId, {contents: '/**/'}), {
		originId,
		files: [{id: resolve('src/foo.ts'), contents: '/**/', originId}],
	});
});

test_toGenResult('fail with an unresolved id', () => {
	t.throws(() => toGenResult('src/foo.ts', {contents: '/**/'}));
});

test_toGenResult('fail with a build id', () => {
	t.throws(() => toGenResult(resolve('.gro/foo.js'), {contents: '/**/'}));
});

test_toGenResult('fail with an empty id', () => {
	t.throws(() => toGenResult('', {contents: '/**/'}));
});

test_toGenResult('custom file name', () => {
	t.equal(
		toGenResult(originId, {
			fileName: 'fooz.ts',
			contents: '/**/',
		}),
		{
			originId,
			files: [{id: resolve('src/fooz.ts'), contents: '/**/', originId}],
		},
	);
});

test_toGenResult('custom file name that matches the default file name', () => {
	t.equal(
		toGenResult(originId, {
			fileName: 'foo.ts',
			contents: '/**/',
		}),
		{
			originId,
			files: [{id: resolve('src/foo.ts'), contents: '/**/', originId}],
		},
	);
});

test_toGenResult('fail when custom file name explicitly matches the origin', () => {
	t.throws(() => {
		toGenResult(originId, {
			fileName: 'foo.gen.ts',
			contents: '/**/',
		});
	});
});

test_toGenResult('fail when file name implicitly matches the origin', () => {
	t.throws(() => {
		toGenResult(resolve('src/foo.ts'), {contents: '/**/'});
	});
});

test_toGenResult('fail with an empty file name', () => {
	t.throws(() => toGenResult(originId, {fileName: '', contents: '/**/'}));
});

test_toGenResult('additional file name parts', () => {
	t.equal(toGenResult(resolve('src/foo.bar.gen.ts'), {contents: '/**/'}), {
		originId: resolve('src/foo.bar.gen.ts'),
		files: [
			{
				id: resolve('src/foo.bar.ts'),
				contents: '/**/',
				originId: resolve('src/foo.bar.gen.ts'),
			},
		],
	});
});

test_toGenResult('js', () => {
	t.equal(
		toGenResult(originId, {
			fileName: 'foo.js',
			contents: '/**/',
		}),
		{
			originId,
			files: [{id: resolve('src/foo.js'), contents: '/**/', originId}],
		},
	);
});

test_toGenResult('implicit custom file extension', () => {
	t.equal(toGenResult(resolve('src/foo.gen.json.ts'), '[/**/]'), {
		originId: resolve('src/foo.gen.json.ts'),
		files: [
			{
				id: resolve('src/foo.json'),
				contents: '[/**/]',
				originId: resolve('src/foo.gen.json.ts'),
			},
		],
	});
});

test_toGenResult('implicit empty file extension', () => {
	t.equal(toGenResult(resolve('src/foo.gen..ts'), '[/**/]'), {
		originId: resolve('src/foo.gen..ts'),
		files: [
			{
				id: resolve('src/foo'),
				contents: '[/**/]',
				originId: resolve('src/foo.gen..ts'),
			},
		],
	});
});

test_toGenResult('implicit custom file extension with additional file name parts', () => {
	t.equal(toGenResult(resolve('src/foo.bar.gen.json.ts'), {contents: '[/**/]'}), {
		originId: resolve('src/foo.bar.gen.json.ts'),
		files: [
			{
				id: resolve('src/foo.bar.json'),
				contents: '[/**/]',
				originId: resolve('src/foo.bar.gen.json.ts'),
			},
		],
	});
});

test_toGenResult('implicit custom file extension with many dots in between', () => {
	t.equal(toGenResult(resolve('src/foo...gen.ts'), '[/**/]'), {
		originId: resolve('src/foo...gen.ts'),
		files: [
			{
				id: resolve('src/foo...ts'),
				contents: '[/**/]',
				originId: resolve('src/foo...gen.ts'),
			},
		],
	});
});

test_toGenResult('fail with two parts following the .gen. pattern in the file name', () => {
	// This just ensures consistent file names - maybe loosen the restriction?
	// You can still implicitly name files like this,
	// but you have to move ".bar" before ".gen".
	t.throws(() => toGenResult(resolve('src/foo.gen.bar.json.ts'), '/**/'));
});

test_toGenResult('fail implicit file extension ending with a dot', () => {
	// This just ensures consistent file names - maybe loosen the restriction?
	// This one is more restrictive than the above,
	// because to have a file ending with a dot
	// you have to use an explicit file name.
	t.throws(() => toGenResult(resolve('src/foo.gen...ts'), '[/**/]'));
});

test_toGenResult('fail without a .gen. pattern in the file name', () => {
	t.throws(() => {
		toGenResult(resolve('src/foo.ts'), '/**/');
	});
});

test_toGenResult(
	'fail without a .gen. pattern in a file name that has multiple other patterns',
	() => {
		t.throws(() => {
			toGenResult(resolve('src/foo.bar.baz.ts'), '/**/');
		});
	},
);

test_toGenResult('fail with two .gen. patterns in the file name', () => {
	t.throws(() => toGenResult(resolve('src/gen.gen.ts'), '/**/'));
	t.throws(() => toGenResult(resolve('src/foo.gen.gen.ts'), '/**/'));
	t.throws(() => toGenResult(resolve('src/foo.gen.bar.gen.ts'), '/**/'));
	t.throws(() => toGenResult(resolve('src/foo.gen.bar.gen.baz.ts'), '/**/'));
});

test_toGenResult('explicit custom file extension', () => {
	t.equal(
		toGenResult(originId, {
			fileName: 'foo.json',
			contents: '[/**/]',
		}),
		{
			originId,
			files: [{id: resolve('src/foo.json'), contents: '[/**/]', originId}],
		},
	);
});

test_toGenResult('explicit custom empty file extension', () => {
	t.equal(
		toGenResult(originId, {
			fileName: 'foo',
			contents: '[/**/]',
		}),
		{
			originId,
			files: [{id: resolve('src/foo'), contents: '[/**/]', originId}],
		},
	);
});

test_toGenResult('explicit custom file extension ending with a dot', () => {
	t.equal(
		toGenResult(originId, {
			fileName: 'foo.',
			contents: '[/**/]',
		}),
		{
			originId,
			files: [{id: resolve('src/foo.'), contents: '[/**/]', originId}],
		},
	);
});

test_toGenResult('simple array of raw files', () => {
	t.equal(toGenResult(originId, [{contents: '/*1*/'}, {fileName: 'foo2.ts', contents: '/*2*/'}]), {
		originId,
		files: [
			{id: resolve('src/foo.ts'), contents: '/*1*/', originId},
			{id: resolve('src/foo2.ts'), contents: '/*2*/', originId},
		],
	});
});

test_toGenResult('complex array of raw files', () => {
	t.equal(
		toGenResult(originId, [
			{contents: '/*1*/'},
			{fileName: 'foo2.ts', contents: '/*2*/'},
			{fileName: 'foo3.ts', contents: '/*3*/'},
			{fileName: 'foo4.ts', contents: '/*4*/'},
			{fileName: 'foo5.json', contents: '[/*5*/]'},
		]),
		{
			originId,
			files: [
				{id: resolve('src/foo.ts'), contents: '/*1*/', originId},
				{id: resolve('src/foo2.ts'), contents: '/*2*/', originId},
				{id: resolve('src/foo3.ts'), contents: '/*3*/', originId},
				{id: resolve('src/foo4.ts'), contents: '/*4*/', originId},
				{id: resolve('src/foo5.json'), contents: '[/*5*/]', originId},
			],
		},
	);
});

test_toGenResult('fail with duplicate names because of omissions', () => {
	t.throws(() => {
		toGenResult(originId, [{contents: '/*1*/'}, {contents: '/*2*/'}]);
	});
});

test_toGenResult('fail with duplicate explicit names', () => {
	t.throws(() => {
		toGenResult(originId, [
			{fileName: 'foo.ts', contents: '/*1*/'},
			{fileName: 'foo.ts', contents: '/*2*/'},
		]);
	});
});

test_toGenResult('fail with duplicate explicit and implicit names', () => {
	t.throws(() => {
		toGenResult(originId, [{contents: '/*1*/'}, {fileName: 'foo.ts', contents: '/*2*/'}]);
	});
});

test_toGenResult.run();
/* /test_toGenResult */
