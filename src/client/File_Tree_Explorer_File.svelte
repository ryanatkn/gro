<script lang="ts">
	import type {File_Tree_File} from 'src/client/file_tree.js';
	import File_Tree_Explorer_Node from './File_Tree_Explorer_Node.svelte';

	export let file: File_Tree_File;
</script>

<div class="file">
	<File_Tree_Explorer_Node node={file} />
</div>
