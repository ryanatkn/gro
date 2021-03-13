<script lang="ts">
	import {SourceTree, filterSelectedMetaItems} from './sourceTree.js';
	import BuildId from './BuildId.svelte';
	import SourceId from './SourceId.svelte';
	import {getBuildsByBuildName} from './sourceTree.js';

	export let sourceTree: SourceTree;
	export let selectedBuildNames: string[];
	export const selectedSourceMeta = undefined;
	export const hoveredSourceMeta = undefined;

	$: filteredSourceMetaItems = filterSelectedMetaItems(sourceTree, selectedBuildNames);
	$: finalItems = filteredSourceMetaItems.flatMap((sourceMeta) =>
		sourceMeta.buildNames
			.map(
				(buildName) =>
					selectedBuildNames.includes(buildName)
						? {sourceMeta, buildName, key: `${buildName}:${sourceMeta.cacheId}`} // TODO hmm
						: null!, // bc filter below
			)
			.filter(Boolean),
	);
</script>

<div>
	{#each finalItems as {sourceMeta, buildName, key} (key)}
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
	}
	.item {
		display: flex;
		align-items: stretch;
	}
	.bg {
		background-color: var(--color_bg_layer);
	}
</style>
