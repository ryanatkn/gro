<script lang="ts">
	import BuildId from './BuildId.svelte';
	import BuildName from './BuildName.svelte';
	import type {SourceTree} from 'src/client/source_tree.js';

	export let source_tree: SourceTree;
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
					<BuildId id={build.id} />
				</td>
				<td>
					<BuildName build_name={build.name} />
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
