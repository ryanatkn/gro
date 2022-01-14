<script lang="ts">
	import BuildId from '$lib/app/BuildId.svelte';
	import BuildName from '$lib/app/BuildName.svelte';
	import {type SourceTree} from '$lib/app/sourceTree';

	export let sourceTree: SourceTree;
	export let selectedBuildNames: string[];
	export const selectedSourceMeta = undefined;
	export const hoveredSourceMeta = undefined;

	$: filteredBuilds = sourceTree.builds.filter((b) => selectedBuildNames.includes(b.buildName));
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
					<BuildName buildName={build.buildName} />
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
