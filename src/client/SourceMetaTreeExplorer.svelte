<script lang="ts">
	import {filterSelectedMetaItems, SourceTree} from './sourceTree.js';
	import SourceId from './SourceId.svelte';

	export let sourceTree: SourceTree;
	export let selectedBuildNames: string[];
	export const selectedSourceMeta = undefined;
	export const hoveredSourceMeta = undefined;

	$: filteredSourceMetaItems = filterSelectedMetaItems(sourceTree, selectedBuildNames);
</script>

<div class="explorer">
	{#each filteredSourceMetaItems as sourceMeta (sourceMeta.cacheId)}
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
