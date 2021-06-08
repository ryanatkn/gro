<script lang="ts">
	import {use_project_state} from './project_state.js';

	const ps = use_project_state();

	export let id: string;

	$: displayed = id.startsWith($ps.source_dir) ? id.substring($ps.source_dir.length - 1) : id;
</script>

<span class="source-id">{displayed}</span>

<style>
	.source-id {
		color: var(--color_0_text);
		white-space: nowrap;
	}
</style>
