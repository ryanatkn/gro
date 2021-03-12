<script>
	import {getContext} from 'svelte';

	export let id;

	const ctx = getContext('buildContext');

	$: displayed = id.startsWith($ctx.sourceDir) ? id.slice($ctx.sourceDir.length - 1) : id;
</script>

<span class="source-id">{displayed}</span>

<style>
	.source-id {
		color: var(--color_0_text);
	}
</style>
