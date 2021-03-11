<script>
	export let sourceTree;
	export const selectedBuildNames = undefined;
	export const selectedSourceMeta = undefined;
	export const hoveredSourceMeta = undefined;
</script>

<table>
	{#each sourceTree.meta as sourceMeta (sourceMeta.cacheId)}
		<tr>
			<td><button>{sourceMeta.data.sourceId}</button></td>
			<td>
				{#each sourceMeta.buildNames as buildName}<span>{buildName}</span>{/each}
			</td>
		</tr>
	{/each}
</table>
