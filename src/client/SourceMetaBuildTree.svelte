<script lang="ts">
	import {filterSelectedMetas} from './sourceTree.js';
	import type {SourceTree} from './sourceTree.js';
	import BuildId from './BuildId.svelte';
	import SourceId from './SourceId.svelte';
	import {getBuildsByBuildName} from './sourceTree.js';

	export let sourceTree: SourceTree;
	export let selectedBuildNames: string[];
	export const selectedSourceMeta = undefined;
	export const hoveredSourceMeta = undefined;

	$: filteredSourceMetas = filterSelectedMetas(sourceTree, selectedBuildNames);
</script>

<div>
	{#each filteredSourceMetas as sourceMeta (sourceMeta.cacheId)}
		{#each sourceMeta.buildNames as buildName (buildName)}
			{#if selectedBuildNames.includes(buildName)}
				<div class="root item bg">
					<div class="content">
						<SourceId id={sourceMeta.data.sourceId} />
					</div>
					<div>
						{#each getBuildsByBuildName(sourceMeta, buildName) as build (build.id)}
							<div class="item bg">
								<div class="content">
									<BuildId id={build.id} />
								</div>
								{#if build.dependencies}
									<div class="content bg">
										<div>
											{#each build.dependencies as dependency (dependency.buildId)}
												<BuildId id={dependency.buildId} />
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
