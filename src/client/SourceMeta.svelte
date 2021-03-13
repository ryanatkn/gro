<script>
	import BuildName from './BuildName.svelte';
	import PlatformName from './PlatformName.svelte';

	export let sourceTree;
	export let selectedBuildNames;
	export let activeSourceMetaView;
	export let selectedSourceMeta;
	export let hoveredSourceMeta;
</script>

<div class="source-meta">
	<form>
		{#each sourceTree.buildConfigs as buildConfig (buildConfig.name)}
			<div>
				<label>
					<input type="checkbox" bind:group={selectedBuildNames} value={buildConfig.name} />
					<BuildName buildName={buildConfig.name} />
					<small>
						({sourceTree.metaByBuildName.get(buildConfig.name).length})

						<PlatformName platformName={buildConfig.platform} />
						{#if buildConfig.primary}primary{/if}
						{#if buildConfig.dist}dist{/if}
					</small>
				</label>
			</div>
		{/each}
	</form>
	<svelte:component
		this={activeSourceMetaView}
		{sourceTree}
		{selectedSourceMeta}
		{hoveredSourceMeta}
		{selectedBuildNames}
	/>
</div>
