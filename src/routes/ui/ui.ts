import type {Plugin} from 'vite';

export interface Options {}

/**
 * @see https://github.com/ryanatkn/gro/pull/508
 */
export const create_gro_dev_vite_plugin = (options?: Options): Plugin => {
	console.log(`options`, options);
	return {
		name: 'gro_dev_vite_plugin',
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
