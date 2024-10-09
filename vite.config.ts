import {defineConfig} from 'vite';
import {sveltekit} from '@sveltejs/kit/vite';

import {create_vite_plugin_gro_gui} from './src/routes/gui/vite_plugin_gro_gui.js';

export default defineConfig({
	plugins: [sveltekit(), create_vite_plugin_gro_gui({})],
	resolve: {
		// this is a hack but it's only to build Gro's website
		alias: [{find: '@ryanatkn/gro/package_meta.js', replacement: './src/lib/package_meta.ts'}],
	},
});
