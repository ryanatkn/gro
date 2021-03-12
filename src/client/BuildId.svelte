<script>
	import {getContext} from 'svelte';

	export let id;

	const ctx = getContext('buildContext');

	$: displayed = id.startsWith($ctx.buildDir) ? id.slice($ctx.buildDir.length - 1) : id;
</script>

<div class="build-id">{displayed}</div>

<style>
	.build-id {
		color: var(--color_1_text);
	}
</style>
