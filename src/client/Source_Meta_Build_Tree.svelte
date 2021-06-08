<script lang="ts">
	import {filter_selected_metas} from './source_tree.js';
	import type {Source_Tree} from './source_tree.js';
	import BuildId from './BuildId.svelte';
	import SourceId from './SourceId.svelte';
	import {getBuildsByBuild_Name} from './source_tree.js';

	export let source_tree: Source_Tree;
	export let selected_build_names: string[];
	export const selected_source_meta = undefined;
	export const hovered_source_meta = undefined;

	$: filteredSource_Metas = filter_selected_metas(source_tree, selected_build_names);
</script>

<div>
	{#each filteredSource_Metas as source_meta (source_meta.cache_id)}
		{#each source_meta.build_names as build_name (build_name)}
			{#if selected_build_names.includes(build_name)}
				<div class="root item bg">
					<div class="content">
						<SourceId id={source_meta.data.source_id} />
					</div>
					<div>
						{#each getBuildsByBuild_Name(source_meta, build_name) as build (build.id)}
							<div class="item bg">
								<div class="content">
									<BuildId id={build.id} />
								</div>
								{#if build.dependencies}
									<div class="content bg">
										<div>
											{#each build.dependencies as dependency (dependency.build_id)}
												<BuildId id={dependency.build_id} />
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
