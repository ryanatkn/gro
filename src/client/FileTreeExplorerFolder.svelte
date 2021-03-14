<script lang="ts">
	import FileTreeExplorerFile from './FileTreeExplorerFile.svelte';
	import {FileTreeFolder} from './fileTree.js';

	export let folder: FileTreeFolder;
</script>

<div>{folder.name}</div>
<ul>
	{#each folder.children as child (child.name)}
		<li>
			{#if child.type === 'folder'}
				<svelte:self folder={child} />
			{:else}
				<FileTreeExplorerFile file={child} />
			{/if}
		</li>
	{/each}
</ul>
