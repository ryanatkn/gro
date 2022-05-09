import {suite} from 'uvu';
import * as assert from 'uvu/assert';
import {resolve} from 'path';

import {toGenResult} from './gen.js';

const originId = resolve('src/foo.gen.ts');

/* test__toGenResult */
const test__toGenResult = suite('toGenResult');

test__toGenResult('plain string', () => {
	assert.equal(toGenResult(originId, '/**/'), {
		originId,
		files: [{id: resolve('src/foo.ts'), content: '/**/', originId, format: true}],
	});
});

test__toGenResult('object with a content string', () => {
	assert.equal(toGenResult(originId, {content: '/**/'}), {
		originId,
		files: [{id: resolve('src/foo.ts'), content: '/**/', originId, format: true}],
	});
});

test__toGenResult('fail with an unresolved id', () => {
	assert.throws(() => toGenResult('src/foo.ts', {content: '/**/'}));
});

test__toGenResult('fail with a build id', () => {
	assert.throws(() => toGenResult(resolve('.gro/foo.js'), {content: '/**/'}));
});

test__toGenResult('fail with an empty id', () => {
	assert.throws(() => toGenResult('', {content: '/**/'}));
});

test__toGenResult('custom file name', () => {
	assert.equal(
		toGenResult(originId, {
			filename: 'fooz.ts',
			content: '/**/',
		}),
		{
			originId,
			files: [{id: resolve('src/fooz.ts'), content: '/**/', originId, format: true}],
		},
	);
});

test__toGenResult('custom file name that matches the default file name', () => {
	assert.equal(
		toGenResult(originId, {
			filename: 'foo.ts',
			content: '/**/',
		}),
		{
			originId,
			files: [{id: resolve('src/foo.ts'), content: '/**/', originId, format: true}],
		},
	);
});

test__toGenResult('fail when custom file name explicitly matches the origin', () => {
	assert.throws(() => {
		toGenResult(originId, {
			filename: 'foo.gen.ts',
			content: '/**/',
		});
	});
});

test__toGenResult('fail when file name implicitly matches the origin', () => {
	assert.throws(() => {
		toGenResult(resolve('src/foo.ts'), {content: '/**/'});
	});
});

test__toGenResult('fail with an empty file name', () => {
	assert.throws(() => toGenResult(originId, {filename: '', content: '/**/'}));
});

test__toGenResult('additional file name parts', () => {
	assert.equal(toGenResult(resolve('src/foo.bar.gen.ts'), {content: '/**/'}), {
		originId: resolve('src/foo.bar.gen.ts'),
		files: [
			{
				id: resolve('src/foo.bar.ts'),
				content: '/**/',
				originId: resolve('src/foo.bar.gen.ts'),
				format: true,
			},
		],
	});
});

test__toGenResult('js', () => {
	assert.equal(
		toGenResult(originId, {
			filename: 'foo.js',
			content: '/**/',
		}),
		{
			originId,
			files: [{id: resolve('src/foo.js'), content: '/**/', originId, format: true}],
		},
	);
});

test__toGenResult('implicit custom file extension', () => {
	assert.equal(toGenResult(resolve('src/foo.gen.json.ts'), '[/**/]'), {
		originId: resolve('src/foo.gen.json.ts'),
		files: [
			{
				id: resolve('src/foo.json'),
				content: '[/**/]',
				originId: resolve('src/foo.gen.json.ts'),
				format: true,
			},
		],
	});
});

test__toGenResult('implicit empty file extension', () => {
	assert.equal(toGenResult(resolve('src/foo.gen..ts'), '[/**/]'), {
		originId: resolve('src/foo.gen..ts'),
		files: [
			{
				id: resolve('src/foo'),
				content: '[/**/]',
				originId: resolve('src/foo.gen..ts'),
				format: true,
			},
		],
	});
});

test__toGenResult('implicit custom file extension with additional file name parts', () => {
	assert.equal(toGenResult(resolve('src/foo.bar.gen.json.ts'), {content: '[/**/]'}), {
		originId: resolve('src/foo.bar.gen.json.ts'),
		files: [
			{
				id: resolve('src/foo.bar.json'),
				content: '[/**/]',
				originId: resolve('src/foo.bar.gen.json.ts'),
				format: true,
			},
		],
	});
});

test__toGenResult('implicit custom file extension with many dots in between', () => {
	assert.equal(toGenResult(resolve('src/foo...gen.ts'), '[/**/]'), {
		originId: resolve('src/foo...gen.ts'),
		files: [
			{
				id: resolve('src/foo...ts'),
				content: '[/**/]',
				originId: resolve('src/foo...gen.ts'),
				format: true,
			},
		],
	});
});

test__toGenResult('fail with two parts following the .gen. pattern in the file name', () => {
	// This just ensures consistent file names - maybe loosen the restriction?
	// You can still implicitly name files like this,
	// but you have to move ".bar" before ".gen".
	assert.throws(() => toGenResult(resolve('src/foo.gen.bar.json.ts'), '/**/'));
});

test__toGenResult('fail implicit file extension ending with a dot', () => {
	// This just ensures consistent file names - maybe loosen the restriction?
	// This one is more restrictive than the above,
	// because to have a file ending with a dot
	// you have to use an explicit file name.
	assert.throws(() => toGenResult(resolve('src/foo.gen...ts'), '[/**/]'));
});

test__toGenResult('fail without a .gen. pattern in the file name', () => {
	assert.throws(() => {
		toGenResult(resolve('src/foo.ts'), '/**/');
	});
});

test__toGenResult(
	'fail without a .gen. pattern in a file name that has multiple other patterns',
	() => {
		assert.throws(() => {
			toGenResult(resolve('src/foo.bar.baz.ts'), '/**/');
		});
	},
);

test__toGenResult('fail with two .gen. patterns in the file name', () => {
	assert.throws(() => toGenResult(resolve('src/gen.gen.ts'), '/**/'));
	assert.throws(() => toGenResult(resolve('src/foo.gen.gen.ts'), '/**/'));
	assert.throws(() => toGenResult(resolve('src/foo.gen.bar.gen.ts'), '/**/'));
	assert.throws(() => toGenResult(resolve('src/foo.gen.bar.gen.baz.ts'), '/**/'));
});

test__toGenResult('explicit custom file extension', () => {
	assert.equal(
		toGenResult(originId, {
			filename: 'foo.json',
			content: '[/**/]',
		}),
		{
			originId,
			files: [{id: resolve('src/foo.json'), content: '[/**/]', originId, format: true}],
		},
	);
});

test__toGenResult('explicit custom empty file extension', () => {
	assert.equal(
		toGenResult(originId, {
			filename: 'foo',
			content: '[/**/]',
		}),
		{
			originId,
			files: [{id: resolve('src/foo'), content: '[/**/]', originId, format: true}],
		},
	);
});

test__toGenResult('explicit custom file extension ending with a dot', () => {
	assert.equal(
		toGenResult(originId, {
			filename: 'foo.',
			content: '[/**/]',
		}),
		{
			originId,
			files: [{id: resolve('src/foo.'), content: '[/**/]', originId, format: true}],
		},
	);
});

test__toGenResult('simple array of raw files', () => {
	assert.equal(
		toGenResult(originId, [{content: '/*1*/'}, {filename: 'foo2.ts', content: '/*2*/'}]),
		{
			originId,
			files: [
				{id: resolve('src/foo.ts'), content: '/*1*/', originId, format: true},
				{id: resolve('src/foo2.ts'), content: '/*2*/', originId, format: true},
			],
		},
	);
});

test__toGenResult('complex array of raw files', () => {
	assert.equal(
		toGenResult(originId, [
			{content: '/*1*/'},
			{filename: 'foo2.ts', content: '/*2*/'},
			{filename: 'foo3.ts', content: '/*3*/'},
			{filename: 'foo4.ts', content: '/*4*/'},
			{filename: 'foo5.json', content: '[/*5*/]'},
		]),
		{
			originId,
			files: [
				{id: resolve('src/foo.ts'), content: '/*1*/', originId, format: true},
				{id: resolve('src/foo2.ts'), content: '/*2*/', originId, format: true},
				{id: resolve('src/foo3.ts'), content: '/*3*/', originId, format: true},
				{id: resolve('src/foo4.ts'), content: '/*4*/', originId, format: true},
				{id: resolve('src/foo5.json'), content: '[/*5*/]', originId, format: true},
			],
		},
	);
});

test__toGenResult('fail with duplicate names because of omissions', () => {
	assert.throws(() => {
		toGenResult(originId, [{content: '/*1*/'}, {content: '/*2*/'}]);
	});
});

test__toGenResult('fail with duplicate explicit names', () => {
	assert.throws(() => {
		toGenResult(originId, [
			{filename: 'foo.ts', content: '/*1*/'},
			{filename: 'foo.ts', content: '/*2*/'},
		]);
	});
});

test__toGenResult('fail with duplicate explicit and implicit names', () => {
	assert.throws(() => {
		toGenResult(originId, [{content: '/*1*/'}, {filename: 'foo.ts', content: '/*2*/'}]);
	});
});

test__toGenResult.run();
/* test__toGenResult */
