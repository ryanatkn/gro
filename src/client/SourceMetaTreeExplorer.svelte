<script lang="ts">
	import {filterSelectedMetas, SourceTree} from './sourceTree.js';
	import SourceId from './SourceId.svelte';

	export let sourceTree: SourceTree;
	export let selectedBuildNames: string[];
	export const selectedSourceMeta = undefined;
	export const hoveredSourceMeta = undefined;

	$: filteredSourceMetas = filterSelectedMetas(sourceTree, selectedBuildNames);
</script>

<div class="explorer">
	{#each filteredSourceMetas as sourceMeta (sourceMeta.cacheId)}
		<div class="node">
			<SourceId id={sourceMeta.data.sourceId} />
		</div>
	{:else}<small><em>no builds selected</em></small>{/each}
</div>

<style>
	.explorer {
		display: flex;
		flex-direction: column;
		align-items: stretch;
	}
	.node {
		display: flex;
		align-items: center;
	}
</style>
