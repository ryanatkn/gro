import {resolve, join} from 'node:path';
import esbuild from 'esbuild';
import fs from 'fs-extra';
import fg from 'fast-glob';
import {spawn} from 'node:child_process';
import {stripStart} from '@feltjs/util/string.js';

/*

This file was previous a one-liner npm script,
but changing use TypeScript 4.5's `type` import modifier
causes esbuild to fail with `preserveValueInputs: true`,
which is different than the TypeScript's compiler behavior.

Not sure if I'm doing something wrong, or if it's a bug in esbuild.
Seems likely it's the former. But as far as I can tell,
its behavior isn't matching what `tsc` outputs.

So we have this rather complex file to bootstrap the project.
See this issue for more: https://github.com/feltjs/gro/pull/292

*/

/* eslint-disable no-console */

const transformOptions = {
	target: 'es2020',
	sourcemap: false,
	format: 'esm',
	loader: 'ts',
	charset: 'utf8',
	tsconfigRaw: {
		compilerOptions: {
			importsNotUsedAsValues: 'remove',
			// preserveValueImports: true,
		},
	},
};

const bootstrap = async () => {
	const dir = resolve('src');
	const distDir = './dist';
	const outDir = resolve(distDir);
	await Promise.all([fs.remove(outDir), fs.remove(resolve('./.gro'))]);

	const startTime = Date.now();

	const globbed = await fg.glob(dir + '/**/*.ts');

	for (const g of globbed) {
		const path = stripStart(g, dir);
		const contents = fs.readFileSync(join(dir, path), 'utf8');
		// @ts-expect-error
		const transformed = esbuild.transformSync(contents, transformOptions);
		const outPath = join(outDir, path).slice(0, -2) + 'js';
		fs.outputFileSync(outPath, transformed.code);
	}

	console.log(`transformed ${globbed.length} files in ${Date.now() - startTime}ms`);

	// @ts-expect-error
	let done, promise, ps;
	promise = new Promise((r) => (done = r));
	ps = spawn('chmod', ['+x', distDir + '/cli/gro.js']);
	ps.on('error', (err) => console.error('err', err));
	// @ts-expect-error
	ps.on('close', () => done());
	await promise;

	promise = new Promise((r) => (done = r));
	ps = spawn('npm', ['link']);
	ps.on('error', (err) => console.error('err', err));
	// @ts-expect-error
	ps.on('close', () => done());
	await promise;
};

bootstrap().catch((err) => {
	console.error('err', err);
	throw err;
});
