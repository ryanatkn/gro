<script>
	import SourceMetaRawItem from './SourceMetaRawItem.svelte';

	export let sourceTree;
	export let selectedBuildNames;
	export const selectedSourceMeta = undefined;
	export let hoveredSourceMeta;

	$: filteredSourceMetaItems = filterSelectedMetaItems(sourceTree, selectedBuildNames);

	// filters those meta items that have some selected build, based on `selectedBuildNames`
	const filterSelectedMetaItems = (sourceTree, selectedBuildNames) =>
		sourceTree.meta.filter((m) => selectedBuildNames.some((n) => m.buildsByName.has(n)));
</script>

{#each filteredSourceMetaItems as sourceMeta (sourceMeta.cacheId)}
	<SourceMetaRawItem {sourceMeta} {hoveredSourceMeta} />
{/each}
