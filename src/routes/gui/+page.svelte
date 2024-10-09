<script lang="ts">
	import {Gui_Client} from './gui_client.js';

	// interface Props {
	// }

	// const {}: Props = $props();

	const gui = new Gui_Client({
		send: (message) => {
			console.log('[page] sending gui_client_message', message);
			import.meta.hot?.send('gro_server_message', message);
		},
	});

	// gui.send({type: 'echo', data: 'echo from client'});
	gui.send({type: 'load_session'});

	const hello_server = () => {
		gui.send({type: 'echo', data: 'hello server'});
	};
	import.meta.hot?.on('gro_client_message', (message) => {
		console.log('[page] receiving gro_client_message', message);
		gui.receive(message);
	});
</script>

<h1>gro gui</h1>

<section>
	<button type="button" onclick={hello_server}>hello server</button>
</section>
