<script lang="ts">
	import {SourceTree, filterSelectedMetas} from './sourceTree.js';
	import {useProjectState} from './projectState.js';
	import FileTreeExplorerFolder from './FileTreeExplorerFolder.svelte';
	import {toFileTreeFolder} from './fileTree.js';

	export let sourceTree: SourceTree;
	export let selectedBuildNames: string[];
	export const selectedSourceMeta = undefined;
	export const hoveredSourceMeta = undefined;

	const ps = useProjectState();

	$: filteredSourceMetas = filterSelectedMetas(sourceTree, selectedBuildNames);
	$: fileTreeFolder = toFileTreeFolder($ps.sourceDir, filteredSourceMetas);
</script>

<div class="build-explorer">
	{#if filteredSourceMetas.length}
		<FileTreeExplorerFolder folder={fileTreeFolder} />
	{:else}<small><em>no builds selected</em></small>{/if}
</div>

<style>
	.build-explorer {
		display: flex;
		align-items: stretch;
	}
	/* TODO how to style these? */
	.build-explorer :global(ul) {
		padding: 0;
		list-style: none;
		background-color: var(--color_bg_layer);
	}
	.build-explorer :global(li) {
		display: flex;
		align-items: center;
	}
</style>
