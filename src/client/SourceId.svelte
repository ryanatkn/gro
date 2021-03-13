<script lang="ts">
	import {useProjectState} from './projectState.js';

	const ctx = useProjectState();

	export let id: string;

	$: displayed = id.startsWith($ctx.sourceDir) ? id.slice($ctx.sourceDir.length - 1) : id;
</script>

<span class="source-id">{displayed}</span>

<style>
	.source-id {
		color: var(--color_0_text);
		white-space: nowrap;
	}
</style>
