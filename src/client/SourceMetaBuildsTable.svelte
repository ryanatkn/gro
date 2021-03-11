<script>
	import {filterSelectedMetaItems} from './sourceTree.js';

	export let sourceTree;
	export let selectedBuildNames;
	export const selectedSourceMeta = undefined;
	export const hoveredSourceMeta = undefined;

	$: filteredBuilds = sourceTree.builds.filter((b) => selectedBuildNames.includes(b.name));
</script>

<table>
	<thead>
		<th>build id</th>
		<th>build name</th>
		<th>dependencies</th>
	</thead>
	{#each filteredBuilds as build (build.id)}
		<tr>
			<td>{build.id}</td>
			<td>{build.name}</td>
			<td>
				{#if build.dependencies}
					{#each build.dependencies as dependency (dependency.buildId)}
						<div>{dependency.buildId}</div>
					{/each}
				{/if}
			</td>
		</tr>
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
