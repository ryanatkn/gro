<script lang="ts">
	import FileTreeExplorerFile from '$lib/app/FileTreeExplorerFile.svelte';
	import FileTreeExplorerNode from '$lib/app/FileTreeExplorerNode.svelte';
	import type {FileTreeFolder} from '$lib/app/fileTree';

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
