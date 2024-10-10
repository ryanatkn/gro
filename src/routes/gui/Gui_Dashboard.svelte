<script lang="ts">
	import type {Gui} from './gui.js';
	import File_List from './File_List.svelte';

	interface Props {
		gui: Gui;
	}

	const {gui}: Props = $props();
</script>

<h1>gro gui dashboard</h1>

<File_List files={gui.files_by_id} />
