<script lang="ts">
	import type {FileTreeFile} from 'src/client/fileTree.js';
	import FileTreeExplorerNode from './FileTreeExplorerNode.svelte';

	export let file: FileTreeFile;
</script>

<div class="file">
	<FileTreeExplorerNode node={file} />
</div>
