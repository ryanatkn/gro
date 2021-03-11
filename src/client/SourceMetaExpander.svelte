<script>
	import SourceMetaExpanderItem from './SourceMetaExpanderItem.svelte';

	export let sourceTree;
	export let selectedBuildNames;
	export let selectedSourceMeta;
	export let hoveredSourceMeta;

	$: filteredSourceMetaItems = filterSelectedMetaItems(sourceTree, selectedBuildNames);

	// filters those meta items that have some selected build, based on `selectedBuildNames`
	const filterSelectedMetaItems = (sourceTree, selectedBuildNames) =>
		sourceTree.meta.filter((m) => selectedBuildNames.some((n) => m.buildsByName.has(n)));
</script>

{#each filteredSourceMetaItems as sourceMeta (sourceMeta.cacheId)}
	<SourceMetaExpanderItem {sourceMeta} {selectedSourceMeta} {hoveredSourceMeta} />
{:else}<small><em>no builds selected</em></small>{/each}
