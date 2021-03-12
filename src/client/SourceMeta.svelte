<script>
	export let sourceTree;
	export let selectedBuildNames;
	export let activeSourceMetaView;
	export let selectedSourceMeta;
	export let hoveredSourceMeta;
</script>

<div class="source-meta">
	<form>
		{#each sourceTree.buildNames as buildName (buildName)}
			<div>
				<label>
					<input type="checkbox" bind:group={selectedBuildNames} value={buildName} />
					{buildName}
					({sourceTree.metaByBuildName.get(buildName).length})
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
