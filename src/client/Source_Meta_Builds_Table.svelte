<script lang="ts">
	import BuildId from './BuildId.svelte';
	import Build_Name from './Build_Name.svelte';
	import type {SourceTree} from './sourceTree.js';

	export let sourceTree: SourceTree;
	export let selectedBuild_Names: string[];
	export const selectedSourceMeta = undefined;
	export const hoveredSourceMeta = undefined;

	$: filteredBuilds = sourceTree.builds.filter((b) => selectedBuild_Names.includes(b.name));
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
					<Build_Name build_name={build.name} />
				</td>
				<td>
					{#if build.dependencies}
						{#each build.dependencies as dependency (dependency.build_id)}
							<div>
								<BuildId id={dependency.build_id} />
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
