<script>
	import BuildId from './BuildId.svelte';
	import BuildName from './BuildName.svelte';
	import {filterSelectedMetaItems} from './sourceTree.js';

	export let sourceTree;
	export let selectedBuildNames;
	export const selectedSourceMeta = undefined;
	export const hoveredSourceMeta = undefined;

	$: filteredBuilds = sourceTree.builds.filter((b) => selectedBuildNames.includes(b.name));
</script>

{#if filteredBuilds.length}
	<table>
		<thead>
			<th>build id</th>
			<th>build name</th>
			<th>dependencies</th>
		</thead>
		{#each filteredBuilds as build (build.id)}
			<tr>
				<td>
					<BuildId id={build.id} />
				</td>
				<td>
					<BuildName buildName={build.name} />
				</td>
				<td>
					{#if build.dependencies}
						{#each build.dependencies as dependency (dependency.buildId)}
							<div>
								<BuildId id={dependency.buildId} />
							</div>
						{/each}
					{/if}
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
