import {defineConfig, type Plugin} from 'vite';
import {sveltekit} from '@sveltejs/kit/vite';

interface Gro_Dev_Plugin_Options {}

const create_gro_dev_plugin = (options?: Gro_Dev_Plugin_Options): Plugin => {
	console.log(`options`, options);
	return {
		name: 'gro_dev_plugin',
		configureServer: (server) => {
			server.ws.on('connection', (_ws, _req) => {
				server.ws.send('gro_client_message', {message: 'hello client!'});
				server.ws.on('gro_server_message', (data) => {
					console.log(`message`, data);
					server.ws.send('gro_client_message', {message: 'received', data});
				});
			});
		},
	};
};

export default defineConfig({
	plugins: [sveltekit(), create_gro_dev_plugin({})],
	resolve: {
		// this is a hack but it's only to build Gro's website
		alias: [{find: '@ryanatkn/gro/package_meta.js', replacement: './src/lib/package_meta.ts'}],
	},
});
