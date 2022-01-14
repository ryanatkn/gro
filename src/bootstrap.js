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
	tsconfigRaw: {
		compilerOptions: {
			importsNotUsedAsValues: 'remove',
			// TODO why does this need to be disabled? behaves differently than `tsc`?
			// preserveValueImports: true,
		},
	},
};

const bootstrap = async () => {
	const dir = resolve('src');
	const outDir = resolve('dist');
	await fs.remove(outDir);
	const watcher = new CheapWatch({
		dir,
		filter: ({path, stats}) => stats.isDirectory() || path.endsWith('.ts'),
		watch: false,
	});
	await fs.remove(outDir);

	let count = 0;
	let startTime = Date.now();

	await watcher.init();
	await Promise.all(
		Array.from(watcher.paths.entries()).map(async ([path, stats]) => {
			if (stats.isDirectory()) return;
			count++;
			const contents = await fs.readFile(join(dir, path), 'utf8');
			const transformed = esbuild.transformSync(contents, transformOptions);
			const outPath = join(outDir, path).slice(0, -2) + 'js';
			await fs.outputFile(outPath, transformed.code);
		}),
	);

	console.log(`transformed ${count} files in ${Date.now() - startTime}ms`);
};

bootstrap().catch((err) => {
	console.error('err', err);
	throw err;
});
