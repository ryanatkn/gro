<script lang="ts">
	import Build_Id from './Build_Id.svelte';
	import Source_Id from './Source_Id.svelte';
	import Build_Name from './Build_Name.svelte';
	import {filter_selected_metas, get_builds_by_build_name} from './source_tree.js';
	import type {Source_Tree} from 'src/client/source_tree.js';

	export let source_tree: Source_Tree;
	export let selected_build_names: string[];
	export const selected_source_meta = undefined;
	export const hovered_source_meta = undefined;

	$: filtered_source_metas = filter_selected_metas(source_tree, selected_build_names);
	$: final_items = filtered_source_metas.flatMap((source_meta) =>
		source_meta.build_names
			.map(
				(build_name) =>
					selected_build_names.includes(build_name)
						? {source_meta, build_name, key: `${build_name}:${source_meta.cache_id}`} // TODO hmm
						: null!, // bc filter below
			)
			.filter(Boolean),
	);
</script>

{#if final_items.length}
	<table>
		<thead>
			<th>source id</th>
			<th>build name</th>
			<th>build ids</th>
		</thead>
		{#each final_items as {source_meta, build_name, key} (key)}
			<tr>
				<td>
					<Source_Id id={source_meta.data.source_id} />
				</td>
				<td>
					<Build_Name {build_name} />
				</td>
				<td>
					{#each get_builds_by_build_name(source_meta, build_name) as build (build.id)}
						<Build_Id id={build.id} />
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
