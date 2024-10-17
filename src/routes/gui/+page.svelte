<script lang="ts">
	import * as devalue from 'devalue';

	import {Gui} from './gui.svelte.js';
	import {Gui_Client} from './gui_client.js';
	import Gui_Hud from './Gui_Hud.svelte';

	// interface Props {
	// }

	// const {}: Props = $props();

	// user: "hey"
	// Claude: "A greeting so brief,
	// Like a whisper of leaf,
	// "Hey" floats on the air,
	// A connection to share."

	const gui_client = new Gui_Client({
		send: (message) => {
			console.log('[page] sending gui_client_message', message);
			import.meta.hot?.send('gro_server_message', message);
		},
		receive: (message) => {
			// TODO where does this mutation code live?
			switch (message.type) {
				case 'loaded_session': {
					console.log(`[page] loaded_session`, message);
					// TODO BLOCK @many is `Source_File[]` but without the circular references, use `devalue` or zts (de)serializers
					for (const source_file of devalue.parse(message.data)) {
						gui.files_by_id.set(source_file.id, source_file);
					}
					break;
				}
				case 'prompt_response': {
					gui.receive_prompt_response(message);
					break;
				}
			}
		},
	});

	const gui = new Gui({client: gui_client});

	// gui.send({type: 'echo', data: 'echo from client'});
	gui_client.send({type: 'load_session'});

	const hello_server = () => {
		gui_client.send({type: 'echo', data: 'hello server'});
	};
	import.meta.hot?.on('gro_client_message', (message) => {
		console.log('[page] receiving gro_client_message', message);
		gui_client.receive(message);
	});
</script>

<h1>gro gui</h1>

<section>
	<button type="button" onclick={hello_server}>hello server</button>
</section>

<Gui_Hud {gui} />
