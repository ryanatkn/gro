import {defineConfig} from 'vite';
import {sveltekit} from '@sveltejs/kit/vite';

import {create_gro_dev_vite_plugin} from './src/routes/gui/gui.js';

export default defineConfig({
	plugins: [sveltekit(), create_gro_dev_vite_plugin({})],
	resolve: {
		// this is a hack but it's only to build Gro's website
		alias: [{find: '@ryanatkn/gro/package_meta.js', replacement: './src/lib/package_meta.ts'}],
	},
});
