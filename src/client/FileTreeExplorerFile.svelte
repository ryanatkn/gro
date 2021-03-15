<script lang="ts">
	import {FileTreeFile} from './fileTree.js';
	import FileTreeExplorerNode from './FileTreeExplorerNode.svelte';

	export let file: FileTreeFile;
</script>

<div class="file">
	<FileTreeExplorerNode node={file} />
</div>
