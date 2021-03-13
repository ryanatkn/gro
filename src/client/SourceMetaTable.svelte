<script lang="ts">
	import BuildId from './BuildId.svelte';
	import SourceId from './SourceId.svelte';
	import BuildName from './BuildName.svelte';
	import {SourceTree, filterSelectedMetaItems} from './sourceTree.js';

	export let sourceTree: SourceTree;
	export let selectedBuildNames: string[];
	export const selectedSourceMeta = undefined;
	export const hoveredSourceMeta = undefined;

	$: filteredSourceMetaItems = filterSelectedMetaItems(sourceTree, selectedBuildNames);
</script>

{#if filteredSourceMetaItems.length}
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
						<td>
							<SourceId id={sourceMeta.data.sourceId} />
						</td>
						<td>
							<BuildName {buildName} />
						</td>
						<td>
							{#each sourceMeta.buildsByBuildName.get(buildName) as build (build.id)}
								<BuildId id={build.id} />
							{/each}
						</td>
					</tr>
				{/if}
			{/each}
		{/each}
	</table>
{:else}<small><em>no builds selected</em></small>{/if}

<style>
	td {
		vertical-align: center;
	}
	tr:nth-child(2n) {
		background-color: #eee;
	}
</style>
