<script>
	export let sourceTree;
	export const selectedBuildNames = undefined;
	export const selectedSourceMeta = undefined;
	export const hoveredSourceMeta = undefined;
</script>

<div class="explorer">
	{#each sourceTree.meta as sourceMeta (sourceMeta.cacheId)}
		<div class="node">{sourceMeta.data.sourceId}</div>
	{/each}
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
