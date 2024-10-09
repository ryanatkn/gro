<script lang="ts">
	import {Gui_Client} from './gui_client.js';

	// interface Props {
	// }

	// const {}: Props = $props();

	const gui = new Gui_Client({
		send: (message) => {
			console.log('gui_client_message', message);
			import.meta.hot?.send('gro_server_message', message);
		},
	});

	gui.send({type: 'echo', data: 'echo from client'});

	const hello_server = () => {
		gui.send({type: 'echo', data: 'hello server'});
	};
	import.meta.hot?.on('gro_client_message', (message) => {
		console.log('gro_client_message', message);
		gui.receive(message);
	});
</script>

<h1>gro gui</h1>

<section>
	<button type="button" onclick={hello_server}>hello server</button>
</section>
