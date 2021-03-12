<script>
	import {getContext} from 'svelte';

	import {toRootPath} from './pathHelpers.js';

	export let id;

	const ctx = getContext('buildContext');

	$: displayed = id.startsWith($ctx.buildDir) ? toRootPath(id, $ctx.buildDir) : id;
</script>

<div class="build-id">{displayed}</div>

<style>
	.build-id {
		color: var(--color_1_text);
	}
</style>
