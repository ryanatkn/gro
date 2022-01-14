import CheapWatch from 'cheap-watch';
import {resolve, join} from 'path';
import esbuild from 'esbuild';
import fs from 'fs-extra';

const transformOptions = {
	target: 'es2020',
	sourcemap: false,
	format: 'esm',
	loader: 'ts',
	charset: 'utf8',
	// tsconfigRaw: {compilerOptions: {importsNotUsedAsValues: 'remove'}},
};

const bootstrap = async () => {
	const dir = resolve('src');
	const outDir = resolve('dist');
	const watcher = new CheapWatch({
		dir,
		filter: ({path, stats}) => stats.isDirectory() || path.endsWith('.ts'),
		watch: false,
	});
	await fs.remove(outDir);

	await watcher.init();
	await Promise.all(
		Array.from(watcher.paths.entries()).map(async ([path, stats]) => {
			if (stats.isDirectory()) return;
			console.log('join(dir, path)', join(dir, path));
			const contents = await fs.readFile(join(dir, path), 'utf8');
			console.log('a', path);
			const transformed = esbuild.transformSync(contents, transformOptions);
			const outPath = join(outDir, path).slice(0, -2) + 'js';
			console.log('outPath', outPath);
			await fs.outputFile(outPath, transformed.code);
		}),
	);
};

bootstrap().catch((err) => {
	console.error('err', err);
	throw err;
});
