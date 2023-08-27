import preprocess from 'svelte-preprocess';
import staticAdapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
export default {
	preprocess: preprocess.typescript(),
	compilerOptions: {
		immutable: true,
	},
	kit: {
		adapter: staticAdapter(),
		files: {assets: 'src/static'},
		alias: {$routes: 'src/routes'},
	},
};
