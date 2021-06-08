<script lang="ts">
	import BuildId from './BuildId.svelte';
	import SourceId from './SourceId.svelte';
	import Build_Name from './Build_Name.svelte';
	import {filterSelectedMetas, getBuildsByBuild_Name} from './sourceTree.js';
	import type {SourceTree} from './sourceTree.js';

	export let sourceTree: SourceTree;
	export let selectedBuild_Names: string[];
	export const selectedSourceMeta = undefined;
	export const hoveredSourceMeta = undefined;

	$: filteredSourceMetas = filterSelectedMetas(sourceTree, selectedBuild_Names);
	$: finalItems = filteredSourceMetas.flatMap((sourceMeta) =>
		sourceMeta.build_names
			.map(
				(build_name) =>
					selectedBuild_Names.includes(build_name)
						? {sourceMeta, build_name, key: `${build_name}:${sourceMeta.cacheId}`} // TODO hmm
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
		{#each finalItems as {sourceMeta, build_name, key} (key)}
			<tr>
				<td>
					<SourceId id={sourceMeta.data.source_id} />
				</td>
				<td>
					<Build_Name {build_name} />
				</td>
				<td>
					{#each getBuildsByBuild_Name(sourceMeta, build_name) as build (build.id)}
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
