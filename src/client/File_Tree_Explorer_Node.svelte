<script lang="ts">
	import type {FileTreeNode} from './fileTree.js';

	export let node: FileTreeNode;
</script>

<div class="node">{node.name}</div>
