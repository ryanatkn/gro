<script lang="ts">
	import BuildId from '$lib/app/BuildId.svelte';
	import SourceId from '$lib/app/SourceId.svelte';
	import BuildName from '$lib/app/BuildName.svelte';
	import {filterSelectedMetas, getBuildsByBuildName} from '$lib/app/sourceTree';
	import type {SourceTree} from '$lib/app/sourceTree.js';

	export let sourceTree: SourceTree;
	export let selectedBuildNames: string[];
	export const selectedSourceMeta = undefined;
	export const hoveredSourceMeta = undefined;

	$: filteredSourceMetas = filterSelectedMetas(sourceTree, selectedBuildNames);
	$: finalItems = filteredSourceMetas.flatMap((sourceMeta) =>
		sourceMeta.buildNames
			.map(
				(buildName) =>
					selectedBuildNames.includes(buildName)
						? {sourceMeta, buildName, key: `${buildName}:${sourceMeta.cacheId}`} // TODO hmm
						: null!, // bc filter below
			)
			.filter(Boolean),
	);
</script>

{#if finalItems.length}
	<table>
		<thead>
			<th>source id</th>
			<th>build name</th>
			<th>build ids</th>
		</thead>
		{#each finalItems as { sourceMeta, buildName, key } (key)}
			<tr>
				<td>
					<SourceId id={sourceMeta.data.sourceId} />
				</td>
				<td>
					<BuildName {buildName} />
				</td>
				<td>
					{#each getBuildsByBuildName(sourceMeta, buildName) as build (build.id)}
						<BuildId id={build.id} />
					{/each}
				</td>
			</tr>
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
