<script lang="ts">
	import {filterSelectedMetas} from '$lib/app/sourceTree';
	import {type SourceTree} from '$lib/app/sourceTree.js';
	import {toFileTreeFolder} from '$lib/app/fileTree';
	import FileTreeExplorerFolder from '$lib/app/FileTreeExplorerFolder.svelte';
	import {getProjectState} from '$lib/app/projectState';

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
