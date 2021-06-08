<script lang="ts">
	import {filter_selected_metas} from './source_tree.js';
	import type {Source_Tree} from './source_tree.js';
	import Build_Id from './Build_Id.svelte';
	import Source_Id from './Source_Id.svelte';
	import {get_builds_by_build_name} from './source_tree.js';

	export let source_tree: Source_Tree;
	export let selected_build_names: string[];
	export const selected_source_meta = undefined;
	export const hovered_source_meta = undefined;

	$: filtered_source_metas = filter_selected_metas(source_tree, selected_build_names);
</script>

<div>
	{#each filtered_source_metas as source_meta (source_meta.cache_id)}
		{#each source_meta.build_names as build_name (build_name)}
			{#if selected_build_names.includes(build_name)}
				<div class="root item bg">
					<div class="content">
						<Source_Id id={source_meta.data.source_id} />
					</div>
					<div>
						{#each get_builds_by_build_name(source_meta, build_name) as build (build.id)}
							<div class="item bg">
								<div class="content">
									<Build_Id id={build.id} />
								</div>
								{#if build.dependencies}
									<div class="content bg">
										<div>
											{#each build.dependencies as dependency (dependency.build_id)}
												<Build_Id id={dependency.build_id} />
											{/each}
										</div>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}
		{/each}
	{:else}<small><em>no builds selected</em></small>{/each}
</div>

<style>
	/* TODO name?? */
	.content {
		display: flex;
		align-items: center;
		padding: var(--spacing_sm);
	}
	.root {
		margin-bottom: var(--spacing_md);
	}
	.item {
		display: flex;
		align-items: stretch;
	}
	.bg {
		background-color: var(--color_bg_layer);
	}
</style>
