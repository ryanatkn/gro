import type {UserConfig} from 'vite';
import {sveltekit} from '@sveltejs/kit/vite';

const config: UserConfig = {
	plugins: [sveltekit()],
	resolve: {
		// this is a hack but it's only to build Gro's website
		alias: [{find: '@ryanatkn/gro/package_meta.js', replacement: './src/lib/package_meta.ts'}],
	},
};

export default config;
