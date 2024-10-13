<script lang="ts">
	import type {SvelteMap} from 'svelte/reactivity';

	import type {Path_Id} from '../../lib/path.js';
	import type {Source_File} from '../../lib/filer.js';
	import File_Info from './File_Info.svelte';

	interface Props {
		// TODO more efficient data structures, reactive source files
		files: SvelteMap<Path_Id, Source_File>;
	}

	const {files}: Props = $props();
</script>

<ul>
	{#each files.values() as file (file.id)}
		<li>
			<File_Info {file} />
		</li>
	{/each}
</ul>
