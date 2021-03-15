<script type="ts">
	import {MarkupNode} from './markup.js';

	export let node: MarkupNode;

	// This currently renders nodes generically based on the available properties,
	// with no regard for the type or if the combination of properties makes sense.
	// We may need to change this strategy in the future to support certain features.
</script>

<div class="markup-{node.type}">
	{#if node.content !== undefined}
		<p>{node.content}</p>
	{/if}
	{#if node.children}
		{#each node.children as child (child.id)}
			<svelte:self node={child} />
		{/each}
	{/if}
</div>
