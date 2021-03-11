<script>
	export let sourceTree;
	export const selectedSourceMeta = undefined;
	export const hoveredSourceMeta = undefined;
</script>

<table>
	{#each sourceTree.meta as sourceMeta (sourceMeta.cacheId)}
		<tr>
			<td><button>{sourceMeta.data.sourceId}</button></td>
			<td>
				{#if sourceMeta.data.builds}
					{#each sourceMeta.data.builds as build}<span>{build.name}</span>{/each}
				{/if}
			</td>
		</tr>
	{/each}
</table>
