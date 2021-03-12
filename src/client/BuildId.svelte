<script>
	import {getContext} from 'svelte';

	export let id;

	const ctx = getContext('buildContext');

	// TODO refactor, move where?
	const toRootPath = (id, buildDir) => {
		let start = buildDir.length - 1;
		for (let i = buildDir.length - 2; i >= 0; i--) {
			const char = buildDir[i];
			if (char === '/') break;
			start--;
		}
		return id.slice(start - 1);
	};

	$: displayed = id.startsWith($ctx.buildDir) ? toRootPath(id, $ctx.buildDir) : id;
</script>

<div class="build-id">{displayed}</div>

<style>
	.build-id {
		color: var(--color_1_text);
	}
</style>
