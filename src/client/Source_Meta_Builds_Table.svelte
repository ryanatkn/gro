<script lang="ts">
	import Build_Id from './Build_Id.svelte';
	import Build_Name from './Build_Name.svelte';
	import type {Source_Tree} from 'src/client/source_tree.js';

	export let source_tree: Source_Tree;
	export let selected_build_names: string[];
	export const selected_source_meta = undefined;
	export const hovered_source_meta = undefined;

	$: filtered_builds = source_tree.builds.filter((b) => selected_build_names.includes(b.name));
</script>

{#if filtered_builds.length}
	<table>
		<thead>
			<th>build id</th>
			<th>build name</th>
			<th>dependencies</th>
		</thead>
		{#each filtered_builds as build (build.id)}
			<tr>
				<td>
					<Build_Id id={build.id} />
				</td>
				<td>
					<Build_Name build_name={build.name} />
				</td>
				<td>
					{#if build.dependencies}
						{#each build.dependencies as dependency (dependency.build_id)}
							<div>
								<Build_Id id={dependency.build_id} />
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
