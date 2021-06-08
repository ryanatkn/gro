<script lang="ts">
	import File_Tree_Explorer_File from './File_Tree_Explorer_File.svelte';
	import File_Tree_Explorer_Node from './File_Tree_Explorer_Node.svelte';
	import type {File_Tree_Folder} from './file_tree.js';

	export let folder: File_Tree_Folder;
</script>

<File_Tree_Explorer_Node node={folder} />
<ul class="folder">
	{#each folder.children as child (child.name)}
		<li class={child.type}>
			{#if child.type === 'folder'}
				<svelte:self folder={child} />
			{:else}
				<File_Tree_Explorer_File file={child} />
			{/if}
		</li>
	{/each}
</ul>
