<script lang="ts">
	import type {Gui} from './gui.js';
	import File_List from './File_List.svelte';
	import Prompt_Form from './Prompt_Form.svelte';

	interface Props {
		gui: Gui;
	}

	const {gui}: Props = $props();
</script>

<h1>gro gui dashboard</h1>

<section>
	<Prompt_Form onsubmit={(text) => gui.send_prompt(text)} />
</section>
<File_List files={gui.files_by_id} />
