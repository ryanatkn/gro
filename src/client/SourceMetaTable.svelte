<script>
	import {filterSelectedMetaItems} from './sourceTree.js';

	export let sourceTree;
	export let selectedBuildNames;
	export const selectedSourceMeta = undefined;
	export const hoveredSourceMeta = undefined;

	$: filteredSourceMetaItems = filterSelectedMetaItems(sourceTree, selectedBuildNames);
</script>

<table>
	{#each filteredSourceMetaItems as sourceMeta (sourceMeta.cacheId)}
		<tr>
			<td>{sourceMeta.data.sourceId}</td>
			<td>
				{#each sourceMeta.buildNames as buildName}<span>{buildName}</span>{/each}
			</td>
			<td>{sourceMeta.data.sourceId}</td>
		</tr>
	{:else}<small><em>no builds selected</em></small>{/each}
</table>
