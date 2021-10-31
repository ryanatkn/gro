<script lang="ts">
	import {filterSelectedMetas} from './sourceTree';
	import type {SourceTree} from 'src/client/sourceTree.js';
	import {toFileTreeFolder} from './fileTree';
	import FileTreeExplorerFolder from './FileTreeExplorerFolder.svelte';
	import {getProjectState} from './projectState';

	export let sourceTree: SourceTree;
	export let selectedBuildNames: string[];
	export const selectedSourceMeta = undefined;
	export const hoveredSourceMeta = undefined;

	const project = getProjectState();

	$: filteredSourceMetas = filterSelectedMetas(sourceTree, selectedBuildNames);
	$: fileTreeFolder = toFileTreeFolder($project.sourceDir, filteredSourceMetas);
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
