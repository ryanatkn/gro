<script>
	import SourceMetaExpanderItem from './SourceMetaExpanderItem.svelte';

	export let sourceTree;
	export let selectedSourceMeta;
	export let hoveredSourceMeta;
</script>

{#each sourceTree.meta as sourceMeta (sourceMeta.cacheId)}
	<SourceMetaExpanderItem {sourceMeta} {selectedSourceMeta} {hoveredSourceMeta} />
{/each}
