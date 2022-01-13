<script lang="ts">
	import {filterSelectedMetas} from '$lib/app/sourceTree';
	import {type SourceTree} from '$lib/app/sourceTree.js';
	import {getProjectState} from '$lib/app/projectState';
	import FileTreeExplorerFolder from '$lib/app/FileTreeExplorerFolder.svelte';
	import {toFileTreeFolder} from '$lib/app/fileTree';

	export let sourceTree: SourceTree;
	export let selectedBuildNames: string[];
	export const selectedSourceMeta = undefined;
	export const hoveredSourceMeta = undefined;

	const project = getProjectState();

	$: console.log('$project', $project);

	$: filteredSourceMetas = filterSelectedMetas(sourceTree, selectedBuildNames);
	$: fileTreeFolder = toFileTreeFolder($project.sourceDir, filteredSourceMetas);
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
	/*
		TODO how to style these?
		these global selectors are just a hacky to get things working.
		might need to redesign concepts to avoid the complex selector logic to get styles right.
	 */
	.build-explorer :global(ul) {
		padding: 0;
		list-style: none;
		background-color: var(--color_bg_layer);
	}
	.build-explorer :global(li.folder) {
		padding: var(--spacing_sm);
		display: flex;
		align-items: center;
	}
	.build-explorer :global(.node) {
		display: flex;
		align-items: center;
		padding: 0 var(--spacing_sm);
	}
	.build-explorer :global(li.folder > .node) {
		padding-left: 0;
	}
</style>
