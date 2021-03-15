<script lang="ts">
	import {SourceTree, filterSelectedMetas} from './sourceTree.js';
	import {useProjectState} from './projectState.js';
	import FileTreeExplorerFolder from './FileTreeExplorerFolder.svelte';
	import {toFileTree} from './fileTree.js';

	export let sourceTree: SourceTree;
	export let selectedBuildNames: string[];
	export const selectedSourceMeta = undefined;
	export const hoveredSourceMeta = undefined;

	const ps = useProjectState();

	$: filteredSourceMetas = filterSelectedMetas(sourceTree, selectedBuildNames);
	$: fileTreeFolder = toFileTree($ps.sourceDir, filteredSourceMetas, 'src');
</script>

<div>
	{#if filteredSourceMetas.length}
		<FileTreeExplorerFolder folder={fileTreeFolder} />
	{:else}<small><em>no builds selected</em></small>{/if}
</div>
