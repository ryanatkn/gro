<script lang="ts">
	import {filterSelectedMetas} from './sourceTree.js';
	import type {SourceTree} from './sourceTree.js';
	import {toFileTreeFolder} from './fileTree.js';
	import FileTreeExplorerFolder from './FileTreeExplorerFolder.svelte';
	import {useProjectState} from './projectState.js';

	export let sourceTree: SourceTree;
	export let selectedBuild_Names: string[];
	export const selectedSourceMeta = undefined;
	export const hoveredSourceMeta = undefined;

	const ps = useProjectState();

	$: filteredSourceMetas = filterSelectedMetas(sourceTree, selectedBuild_Names);
	$: fileTreeFolder = toFileTreeFolder($ps.sourceDir, filteredSourceMetas);
</script>

<div class="explorer">
	{#if filteredSourceMetas.length}
		<FileTreeExplorerFolder folder={fileTreeFolder} />
	{:else}<small><em>no builds selected</em></small>{/if}
</div>

<style>
	.explorer {
		display: flex;
		flex-direction: column;
		align-items: stretch;
	}
</style>
