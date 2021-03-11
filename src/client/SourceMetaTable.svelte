<script>
	import {filterSelectedMetaItems} from './sourceTree.js';

	export let sourceTree;
	export let selectedBuildNames;
	export const selectedSourceMeta = undefined;
	export const hoveredSourceMeta = undefined;

	$: filteredSourceMetaItems = filterSelectedMetaItems(sourceTree, selectedBuildNames);
</script>

<table>
	<thead>
		<th>source id</th>
		<th>build name</th>
		<th>build ids</th>
	</thead>
	{#each filteredSourceMetaItems as sourceMeta (sourceMeta.cacheId)}
		{#each sourceMeta.buildNames as buildName (buildName)}
			{#if selectedBuildNames.includes(buildName)}
				<tr>
					<td>{sourceMeta.data.sourceId}</td>
					<td>{buildName}</td>
					<td>
						{#each sourceMeta.buildsByBuildName.get(buildName) as build (build.id)}
							<div>{build.id}</div>
						{/each}
					</td>
				</tr>
			{/if}
		{/each}
	{:else}<small><em>no builds selected</em></small>{/each}
</table>

<style>
	td {
		vertical-align: center;
	}
	tr:nth-child(2n) {
		background-color: #eee;
	}
</style>
