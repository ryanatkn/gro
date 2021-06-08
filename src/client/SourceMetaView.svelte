<script lang="ts">
	import type {Writable} from 'svelte/store';

	import Build_Name from './Build_Name.svelte';
	import PlatformName from './PlatformName.svelte';
	import {getMetasByBuild_Name} from './sourceTree.js';
	import type {SourceTree} from './sourceTree.js';
	import type {View} from './view.js';
	import type {SourceMeta} from '../build/sourceMeta.js';

	export let sourceTree: SourceTree;
	export let selectedBuild_Names: string[];
	export let activeSourceMetaView: View;
	export let selectedSourceMeta: Writable<SourceMeta | null>;
	export let hoveredSourceMeta: Writable<SourceMeta | null>;
</script>

<div class="source-meta">
	<form>
		{#each sourceTree.build_configs as build_config (build_config.name)}
			<div>
				<label>
					<input type="checkbox" bind:group={selectedBuild_Names} value={build_config.name} />
					<Build_Name build_name={build_config.name} />
					<small>
						({getMetasByBuild_Name(sourceTree, build_config.name).length})

						<PlatformName platformName={build_config.platform} />
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
		{selectedBuild_Names}
	/>
</div>
