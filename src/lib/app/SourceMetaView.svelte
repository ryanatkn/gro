<script lang="ts">
	import {type Writable} from 'svelte/store';

	import BuildName from '$lib/app/BuildName.svelte';
	import PlatformName from '$lib/app/PlatformName.svelte';
	import {getMetasByBuildName} from '$lib/app/sourceTree';
	import {type SourceTree} from '$lib/app/sourceTree.js';
	import {type View} from '$lib/app/view.js';
	import {type SourceMeta} from 'src/build/sourceMeta.js';

	export let sourceTree: SourceTree;
	export let selectedBuildNames: string[];
	export let activeSourceMetaView: View;
	export let selectedSourceMeta: Writable<SourceMeta | null>;
	export let hoveredSourceMeta: Writable<SourceMeta | null>;
</script>

<div class="source-meta">
	<form>
		{#each sourceTree.buildConfigs as buildConfig (buildConfig.name)}
			<div>
				<label>
					<input type="checkbox" bind:group={selectedBuildNames} value={buildConfig.name} />
					<BuildName buildName={buildConfig.name} />
					<small>
						({getMetasByBuildName(sourceTree, buildConfig.name).length})

						<PlatformName platformName={buildConfig.platform} />
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
