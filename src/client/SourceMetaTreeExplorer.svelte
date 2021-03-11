<script>
	import {filterSelectedMetaItems} from './sourceTree.js';

	export let sourceTree;
	export let selectedBuildNames;
	export const selectedSourceMeta = undefined;
	export const hoveredSourceMeta = undefined;

	$: filteredSourceMetaItems = filterSelectedMetaItems(sourceTree, selectedBuildNames);
</script>

<div class="explorer">
	{#each filteredSourceMetaItems as sourceMeta (sourceMeta.cacheId)}
		<div class="node">{sourceMeta.data.sourceId}</div>
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
