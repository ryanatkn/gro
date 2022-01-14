<script lang="ts">
	import {type FileTreeNode} from '$lib/app/fileTree';

	export let node: FileTreeNode;
</script>

<div class="node">{node.name}</div>
