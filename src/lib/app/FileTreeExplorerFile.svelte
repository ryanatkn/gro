<script lang="ts">
	import {type FileTreeFile} from '$lib/app/fileTree.js';
	import FileTreeExplorerNode from '$lib/app/FileTreeExplorerNode.svelte';

	export let file: FileTreeFile;
</script>

<div class="file">
	<FileTreeExplorerNode node={file} />
</div>
