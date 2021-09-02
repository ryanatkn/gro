import {suite} from 'uvu';
import * as t from 'uvu/assert';
import {resolve} from 'path';

import {toGenResult} from './gen.js';

const originId = resolve('src/foo.gen.ts');

/* testToGenResult */
const testToGenResult = suite('toGenResult');

testToGenResult('plain string', () => {
	t.equal(toGenResult(originId, '/**/'), {
		originId,
		files: [{id: resolve('src/foo.ts'), content: '/**/', originId}],
	});
});

testToGenResult('object with a content string', () => {
	t.equal(toGenResult(originId, {content: '/**/'}), {
		originId,
		files: [{id: resolve('src/foo.ts'), content: '/**/', originId}],
	});
});

testToGenResult('fail with an unresolved id', () => {
	t.throws(() => toGenResult('src/foo.ts', {content: '/**/'}));
});

testToGenResult('fail with a build id', () => {
	t.throws(() => toGenResult(resolve('.gro/foo.js'), {content: '/**/'}));
});

testToGenResult('fail with an empty id', () => {
	t.throws(() => toGenResult('', {content: '/**/'}));
});

testToGenResult('custom file name', () => {
	t.equal(
		toGenResult(originId, {
			filename: 'fooz.ts',
			content: '/**/',
		}),
		{
			originId,
			files: [{id: resolve('src/fooz.ts'), content: '/**/', originId}],
		},
	);
});

testToGenResult('custom file name that matches the default file name', () => {
	t.equal(
		toGenResult(originId, {
			filename: 'foo.ts',
			content: '/**/',
		}),
		{
			originId,
			files: [{id: resolve('src/foo.ts'), content: '/**/', originId}],
		},
	);
});

testToGenResult('fail when custom file name explicitly matches the origin', () => {
	t.throws(() => {
		toGenResult(originId, {
			filename: 'foo.gen.ts',
			content: '/**/',
		});
	});
});

testToGenResult('fail when file name implicitly matches the origin', () => {
	t.throws(() => {
		toGenResult(resolve('src/foo.ts'), {content: '/**/'});
	});
});

testToGenResult('fail with an empty file name', () => {
	t.throws(() => toGenResult(originId, {filename: '', content: '/**/'}));
});

testToGenResult('additional file name parts', () => {
	t.equal(toGenResult(resolve('src/foo.bar.gen.ts'), {content: '/**/'}), {
		originId: resolve('src/foo.bar.gen.ts'),
		files: [
			{
				id: resolve('src/foo.bar.ts'),
				content: '/**/',
				originId: resolve('src/foo.bar.gen.ts'),
			},
		],
	});
});

testToGenResult('js', () => {
	t.equal(
		toGenResult(originId, {
			filename: 'foo.js',
			content: '/**/',
		}),
		{
			originId,
			files: [{id: resolve('src/foo.js'), content: '/**/', originId}],
		},
	);
});

testToGenResult('implicit custom file extension', () => {
	t.equal(toGenResult(resolve('src/foo.gen.json.ts'), '[/**/]'), {
		originId: resolve('src/foo.gen.json.ts'),
		files: [
			{
				id: resolve('src/foo.json'),
				content: '[/**/]',
				originId: resolve('src/foo.gen.json.ts'),
			},
		],
	});
});

testToGenResult('implicit empty file extension', () => {
	t.equal(toGenResult(resolve('src/foo.gen..ts'), '[/**/]'), {
		originId: resolve('src/foo.gen..ts'),
		files: [
			{
				id: resolve('src/foo'),
				content: '[/**/]',
				originId: resolve('src/foo.gen..ts'),
			},
		],
	});
});

testToGenResult('implicit custom file extension with additional file name parts', () => {
	t.equal(toGenResult(resolve('src/foo.bar.gen.json.ts'), {content: '[/**/]'}), {
		originId: resolve('src/foo.bar.gen.json.ts'),
		files: [
			{
				id: resolve('src/foo.bar.json'),
				content: '[/**/]',
				originId: resolve('src/foo.bar.gen.json.ts'),
			},
		],
	});
});

testToGenResult('implicit custom file extension with many dots in between', () => {
	t.equal(toGenResult(resolve('src/foo...gen.ts'), '[/**/]'), {
		originId: resolve('src/foo...gen.ts'),
		files: [
			{
				id: resolve('src/foo...ts'),
				content: '[/**/]',
				originId: resolve('src/foo...gen.ts'),
			},
		],
	});
});

testToGenResult('fail with two parts following the .gen. pattern in the file name', () => {
	// This just ensures consistent file names - maybe loosen the restriction?
	// You can still implicitly name files like this,
	// but you have to move ".bar" before ".gen".
	t.throws(() => toGenResult(resolve('src/foo.gen.bar.json.ts'), '/**/'));
});

testToGenResult('fail implicit file extension ending with a dot', () => {
	// This just ensures consistent file names - maybe loosen the restriction?
	// This one is more restrictive than the above,
	// because to have a file ending with a dot
	// you have to use an explicit file name.
	t.throws(() => toGenResult(resolve('src/foo.gen...ts'), '[/**/]'));
});

testToGenResult('fail without a .gen. pattern in the file name', () => {
	t.throws(() => {
		toGenResult(resolve('src/foo.ts'), '/**/');
	});
});

testToGenResult(
	'fail without a .gen. pattern in a file name that has multiple other patterns',
	() => {
		t.throws(() => {
			toGenResult(resolve('src/foo.bar.baz.ts'), '/**/');
		});
	},
);

testToGenResult('fail with two .gen. patterns in the file name', () => {
	t.throws(() => toGenResult(resolve('src/gen.gen.ts'), '/**/'));
	t.throws(() => toGenResult(resolve('src/foo.gen.gen.ts'), '/**/'));
	t.throws(() => toGenResult(resolve('src/foo.gen.bar.gen.ts'), '/**/'));
	t.throws(() => toGenResult(resolve('src/foo.gen.bar.gen.baz.ts'), '/**/'));
});

testToGenResult('explicit custom file extension', () => {
	t.equal(
		toGenResult(originId, {
			filename: 'foo.json',
			content: '[/**/]',
		}),
		{
			originId,
			files: [{id: resolve('src/foo.json'), content: '[/**/]', originId}],
		},
	);
});

testToGenResult('explicit custom empty file extension', () => {
	t.equal(
		toGenResult(originId, {
			filename: 'foo',
			content: '[/**/]',
		}),
		{
			originId,
			files: [{id: resolve('src/foo'), content: '[/**/]', originId}],
		},
	);
});

testToGenResult('explicit custom file extension ending with a dot', () => {
	t.equal(
		toGenResult(originId, {
			filename: 'foo.',
			content: '[/**/]',
		}),
		{
			originId,
			files: [{id: resolve('src/foo.'), content: '[/**/]', originId}],
		},
	);
});

testToGenResult('simple array of raw files', () => {
	t.equal(toGenResult(originId, [{content: '/*1*/'}, {filename: 'foo2.ts', content: '/*2*/'}]), {
		originId,
		files: [
			{id: resolve('src/foo.ts'), content: '/*1*/', originId},
			{id: resolve('src/foo2.ts'), content: '/*2*/', originId},
		],
	});
});

testToGenResult('complex array of raw files', () => {
	t.equal(
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
				{id: resolve('src/foo.ts'), content: '/*1*/', originId},
				{id: resolve('src/foo2.ts'), content: '/*2*/', originId},
				{id: resolve('src/foo3.ts'), content: '/*3*/', originId},
				{id: resolve('src/foo4.ts'), content: '/*4*/', originId},
				{id: resolve('src/foo5.json'), content: '[/*5*/]', originId},
			],
		},
	);
});

testToGenResult('fail with duplicate names because of omissions', () => {
	t.throws(() => {
		toGenResult(originId, [{content: '/*1*/'}, {content: '/*2*/'}]);
	});
});

testToGenResult('fail with duplicate explicit names', () => {
	t.throws(() => {
		toGenResult(originId, [
			{filename: 'foo.ts', content: '/*1*/'},
			{filename: 'foo.ts', content: '/*2*/'},
		]);
	});
});

testToGenResult('fail with duplicate explicit and implicit names', () => {
	t.throws(() => {
		toGenResult(originId, [{content: '/*1*/'}, {filename: 'foo.ts', content: '/*2*/'}]);
	});
});

testToGenResult.run();
/* /testToGenResult */
