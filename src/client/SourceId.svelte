<script>
	import {getContext} from 'svelte';

	export let id;

	// TODO import `paths` directly instead and remove this
	const rootDir = getContext('rootDir');
	$: dir = `${$rootDir}src/`;

	$: displayed = id.startsWith(dir) ? id.slice(dir.length - 1) : id;
</script>

<span class="source-id">{displayed}</span>

<style>
	.source-id {
		color: var(--color_0_text);
	}
</style>
