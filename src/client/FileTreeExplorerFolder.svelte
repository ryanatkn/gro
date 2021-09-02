<script lang="ts">
	import FileTreeExplorerFile from './FileTreeExplorerFile.svelte';
	import FileTreeExplorerNode from './FileTreeExplorerNode.svelte';
	import type {FileTreeFolder} from 'src/client/fileTree.js';

	export let folder: FileTreeFolder;
</script>

<FileTreeExplorerNode node={folder} />
<ul class="folder">
	{#each folder.children as child (child.name)}
		<li class={child.type}>
			{#if child.type === 'folder'}
				<svelte:self folder={child} />
			{:else}
				<FileTreeExplorerFile file={child} />
			{/if}
		</li>
	{/each}
</ul>
