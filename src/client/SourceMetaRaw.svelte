<script>
	import SourceMetaRawItem from './SourceMetaRawItem.svelte';
	import {filterSelectedMetaItems} from './sourceTree.js';

	export let sourceTree;
	export let selectedBuildNames;
	export const selectedSourceMeta = undefined;
	export let hoveredSourceMeta;

	$: filteredSourceMetaItems = filterSelectedMetaItems(sourceTree, selectedBuildNames);
</script>

{#each filteredSourceMetaItems as sourceMeta (sourceMeta.cacheId)}
	<SourceMetaRawItem {sourceMeta} {hoveredSourceMeta} />
{:else}<small><em>no builds selected</em></small>{/each}
