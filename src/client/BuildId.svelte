<script>
	import {getContext} from 'svelte';

	export let id;

	// TODO import `paths` directly instead and remove this
	const rootDir = getContext('rootDir');

	$: displayed = id.startsWith($rootDir) ? id.slice($rootDir.length - 1) : id;
</script>

<div class="build-id">{displayed}</div>

<style>
	.build-id {
		color: var(--color_1_text);
	}
</style>
