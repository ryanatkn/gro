<script lang="ts">
	import type {Snippet} from 'svelte';
	import Docs from '@ryanatkn/fuz/Docs.svelte';
	import {pkg_context} from '@ryanatkn/fuz/pkg.svelte.js';

	import {tomes} from '$routes/docs/tomes.js';

	const {
		children,
	}: {
		children: Snippet;
	} = $props();

	const pkg = pkg_context.get();
</script>

<Docs {tomes} {pkg}>
	{@render children()}
</Docs>
