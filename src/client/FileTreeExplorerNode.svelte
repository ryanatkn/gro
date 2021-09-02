<script lang="ts">
	import type {FileTreeNode} from 'src/client/fileTree.js';

	export let node: FileTreeNode;
</script>

<div class="node">{node.name}</div>
