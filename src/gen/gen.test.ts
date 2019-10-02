import * as fp from 'path';
const {resolve} = fp; // TODO esm

import {test} from '../oki/index.js';
import {toGenResult} from './gen.js';

test('toGenResult', t => {
	test('plain string', () => {
		t.equal(toGenResult(resolve('build/foo.gen.js'), '/**/'), {
			originFileId: resolve('build/foo.gen.js'),
			files: [
				{
					id: resolve('build/foo.js'),
					contents: '/**/',
				},
			],
		});
	});
	test('object with a contents string', () => {
		t.equal(toGenResult(resolve('build/foo.gen.js'), {contents: '/**/'}), {
			originFileId: resolve('build/foo.gen.js'),
			files: [
				{
					id: resolve('build/foo.js'),
					contents: '/**/',
				},
			],
		});
	});
	test('custom file name', () => {
		t.equal(
			toGenResult(resolve('build/foo.gen.js'), {
				fileName: 'fooz.js',
				contents: '/**/',
			}),
			{
				originFileId: resolve('build/foo.gen.js'),
				files: [
					{
						id: resolve('build/fooz.js'),
						contents: '/**/',
					},
				],
			},
		);
	});
	test('fail when custom file name explicitly matches the origin', () => {
		t.throws(() => {
			toGenResult(resolve('build/foo.gen.js'), {
				fileName: 'foo.gen.js',
				contents: '/**/',
			});
		});
	});
	test('fail when file name implicitly matches the origin', () => {
		t.throws(() => {
			toGenResult(resolve('build/foo.js'), {
				contents: '/**/',
			});
		});
	});
	test('output to source', () => {
		t.equal(
			toGenResult(resolve('build/foo.gen.js'), {
				contents: '/**/',
				outputToSource: true,
			}),
			{
				originFileId: resolve('build/foo.gen.js'),
				files: [
					{
						id: resolve('src/foo.ts'),
						contents: '/**/',
					},
				],
			},
		);
	});
	test('output to source with a js file name', () => {
		t.equal(
			toGenResult(resolve('build/foo.gen.js'), {
				contents: '/**/',
				fileName: 'foo.js',
				outputToSource: true,
			}),
			{
				originFileId: resolve('build/foo.gen.js'),
				files: [
					{
						id: resolve('src/foo.js'),
						contents: '/**/',
					},
				],
			},
		);
	});
	test('output to source is false', () => {
		t.equal(
			toGenResult(resolve('build/foo.gen.js'), {
				contents: '/**/',
				fileName: 'foo.js',
				outputToSource: false,
			}),
			{
				originFileId: resolve('build/foo.gen.js'),
				files: [
					{
						id: resolve('build/foo.js'),
						contents: '/**/',
					},
				],
			},
		);
	});
	test('infer output to source based on file name', () => {
		t.equal(
			toGenResult(resolve('build/foo.gen.js'), {
				fileName: 'foo.ts',
				contents: '/**/',
			}),
			{
				originFileId: resolve('build/foo.gen.js'),
				files: [
					{
						id: resolve('src/foo.ts'),
						contents: '/**/',
					},
				],
			},
		);
	});
	test('implicit different file extension', () => {
		t.equal(toGenResult(resolve('build/foo.gen.json.js'), '[/**/]'), {
			originFileId: resolve('build/foo.gen.json.js'),
			files: [
				{
					id: resolve('build/foo.json'),
					contents: '[/**/]',
				},
			],
		});
	});
	test('implicit different file extension with additional file name parts', () => {
		t.equal(
			toGenResult(resolve('build/foo.bar.baz.gen.json.js'), {
				contents: '[/**/]',
			}),
			{
				originFileId: resolve('build/foo.bar.baz.gen.json.js'),
				files: [
					{
						id: resolve('build/foo.bar.baz.json'),
						contents: '[/**/]',
					},
				],
			},
		);
	});
	test('fails without a .gen. pattern in the file name', () => {
		t.throws(() => {
			toGenResult(resolve('build/foo.js'), '/**/');
		});
	});
	test('fails without a .gen. pattern in a file name that has multiple other patterns', () => {
		t.throws(() => {
			toGenResult(resolve('build/foo.bar.baz.js'), '/**/');
		});
	});
	test('fails with two .gen. patterns in the file name', () => {
		t.throws(() => {
			toGenResult(resolve('build/gen.gen.js'), '/**/');
		});
		t.throws(() => {
			toGenResult(resolve('build/foo.gen.gen.js'), '/**/');
		});
		t.throws(() => {
			toGenResult(resolve('build/foo.gen.bar.gen.js'), '/**/');
		});
		t.throws(() => {
			toGenResult(resolve('build/foo.gen.bar.gen.baz.js'), '/**/');
		});
	});
	test('fails with two parts following the .gen. pattern in the file name', () => {
		t.throws(() => {
			toGenResult(resolve('build/foo.gen.bar.json.js'), '/**/');
		});
	});
	test('explicit custom file extension', () => {
		t.equal(
			toGenResult(resolve('build/foo.gen.js'), {
				fileName: 'foo.json',
				contents: '[/**/]',
			}),
			{
				originFileId: resolve('build/foo.gen.js'),
				files: [
					{
						id: resolve('build/foo.json'),
						contents: '[/**/]',
					},
				],
			},
		);
	});
	test('output to source with an implicit different file extension', () => {
		t.equal(
			toGenResult(resolve('build/foo.gen.json.js'), {
				contents: '[/**/]',
				outputToSource: true,
			}),
			{
				originFileId: resolve('build/foo.gen.json.js'),
				files: [
					{
						id: resolve('src/foo.json'),
						contents: '[/**/]',
					},
				],
			},
		);
	});
	test('output to source with an explicit custom file extension', () => {
		t.equal(
			toGenResult(resolve('build/foo.gen.js'), {
				contents: '[/**/]',
				fileName: 'foo.json',
				outputToSource: true,
			}),
			{
				originFileId: resolve('build/foo.gen.js'),
				files: [
					{
						id: resolve('src/foo.json'),
						contents: '[/**/]',
					},
				],
			},
		);
	});
	test('simple array of raw files', () => {
		t.equal(
			toGenResult(resolve('build/foo.gen.js'), [
				{contents: '/*1*/'},
				{fileName: 'foo2.js', contents: '/*2*/'},
			]),
			{
				originFileId: resolve('build/foo.gen.js'),
				files: [
					{
						id: resolve('build/foo.js'),
						contents: '/*1*/',
					},
					{
						id: resolve('build/foo2.js'),
						contents: '/*2*/',
					},
				],
			},
		);
	});
	test('complex array of raw files', () => {
		t.equal(
			toGenResult(resolve('build/foo.gen.js'), [
				{contents: '/*1*/'},
				{fileName: 'foo2.js', contents: '/*2*/'},
				{fileName: 'foo3.ts', contents: '/*3*/'},
				{
					fileName: 'foo4.ts',
					contents: '/*4*/',
					outputToSource: true,
				},
				{fileName: 'foo5.json', contents: '[/*5*/]', outputToSource: true},
			]),
			{
				originFileId: resolve('build/foo.gen.js'),
				files: [
					{
						id: resolve('build/foo.js'),
						contents: '/*1*/',
					},
					{
						id: resolve('build/foo2.js'),
						contents: '/*2*/',
					},
					{
						id: resolve('src/foo3.ts'),
						contents: '/*3*/',
					},
					{
						id: resolve('src/foo4.ts'),
						contents: '/*4*/',
					},
					{
						id: resolve('src/foo5.json'),
						contents: '[/*5*/]',
					},
				],
			},
		);
	});
	test('fails with duplicate names because of omissions', () => {
		t.throws(() => {
			toGenResult(resolve('build/foo.gen.js'), [
				{contents: '/*1*/'},
				{contents: '/*2*/'},
			]);
		});
	});
	test('fails with duplicate explicit names', () => {
		t.throws(() => {
			toGenResult(resolve('build/foo.gen.js'), [
				{fileName: 'foo.js', contents: '/*1*/'},
				{fileName: 'foo.js', contents: '/*2*/'},
			]);
		});
	});
	test('fails with duplicate explicit and implicit names', () => {
		t.throws(() => {
			toGenResult(resolve('build/foo.gen.js'), [
				{contents: '/*1*/'},
				{fileName: 'foo.js', contents: '/*2*/'},
			]);
		});
	});
});
