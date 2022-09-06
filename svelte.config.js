import {typescript} from 'svelte-preprocess-esbuild';
import staticAdapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
export default {
	preprocess: typescript(),
	compilerOptions: {
		immutable: true,
	},
	kit: {
		adapter: staticAdapter({fallback: '404.html'}),
		files: {assets: 'src/static'},
	},
};
