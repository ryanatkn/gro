<script lang="ts">
	import {useProjectState} from './projectState.js';

	const ps = useProjectState();

	export let id: string;

	$: displayed = id.startsWith($ps.sourceDir) ? id.substring($ps.sourceDir.length - 1) : id;
</script>

<span class="source-id">{displayed}</span>

<style>
	.source-id {
		color: var(--color_0_text);
		white-space: nowrap;
	}
</style>
