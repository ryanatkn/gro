<script>
	import SourceMetaRawItem from './SourceMetaRawItem.svelte';

	export let sourceTree;
	export const selectedSourceMeta = undefined;
	export let hoveredSourceMeta;
</script>

{#each sourceTree.meta as sourceMeta (sourceMeta.cacheId)}
	<SourceMetaRawItem {sourceMeta} {hoveredSourceMeta} />
{/each}
