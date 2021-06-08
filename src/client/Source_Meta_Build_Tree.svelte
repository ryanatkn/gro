<script lang="ts">
	import {filterSelectedMetas} from './sourceTree.js';
	import type {SourceTree} from './sourceTree.js';
	import BuildId from './BuildId.svelte';
	import SourceId from './SourceId.svelte';
	import {getBuildsByBuild_Name} from './sourceTree.js';

	export let sourceTree: SourceTree;
	export let selectedBuild_Names: string[];
	export const selectedSourceMeta = undefined;
	export const hoveredSourceMeta = undefined;

	$: filteredSourceMetas = filterSelectedMetas(sourceTree, selectedBuild_Names);
</script>

<div>
	{#each filteredSourceMetas as source_meta (source_meta.cacheId)}
		{#each source_meta.build_names as build_name (build_name)}
			{#if selectedBuild_Names.includes(build_name)}
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
