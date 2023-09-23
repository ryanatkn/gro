// @see https://github.com/lukeed/svelte-preprocess-esbuild/issues/8
//@ts-expect-error
import {typescript} from 'svelte-preprocess-esbuild';
import staticAdapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
export default {
	preprocess: typescript(),
	compilerOptions: {
		immutable: true,
	},
	kit: {
		adapter: staticAdapter(),
		files: {assets: 'src/static'},
		alias: {$routes: 'src/routes', $fixtures: 'src/fixtures'},
	},
};
