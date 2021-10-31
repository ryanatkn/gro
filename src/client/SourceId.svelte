<script lang="ts">
	import {getProjectState} from './projectState';

	const project = getProjectState();

	export let id: string;

	$: displayed = id.startsWith($project.sourceDir)
		? id.substring($project.sourceDir.length - 1)
		: id;
</script>

<span class="source-id">{displayed}</span>

<style>
	.source-id {
		color: var(--color_0_text);
		white-space: nowrap;
	}
</style>
