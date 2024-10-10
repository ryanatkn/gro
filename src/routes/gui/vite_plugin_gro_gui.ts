import type {Plugin} from 'vite';

import {Gui_Server} from './gui_server.server.js';

export interface Options {}

/**
 * @see https://github.com/ryanatkn/gro/pull/508
 */
export const create_vite_plugin_gro_gui = (options?: Options): Plugin => {
	console.log(`options`, options);
	return {
		name: 'vite_plugin_gro_gui',
		configureServer: (server) => {
			const gui = new Gui_Server({
				send: (message) => {
					server.ws.send('gro_client_message', message);
				},
			});
			server.ws.on('connection', (_ws, _req) => {
				gui.send({type: 'echo', data: 'hello client!'});
			});
			server.ws.on('gro_server_message', (data) => {
				console.log(`receiving gro_server_message`, data);
				gui.receive(data);
			});
		},
	};
};
