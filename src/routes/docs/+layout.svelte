<script lang="ts">
	import type {Snippet} from 'svelte';
	import Docs from '@ryanatkn/fuz/Docs.svelte';
	import {library_context} from '@ryanatkn/fuz/library.svelte.js';

	import {tomes} from '$routes/docs/tomes.js';

	const {
		children,
	}: {
		children: Snippet;
	} = $props();

	const library = library_context.get();
</script>

<Docs {tomes} {library}>
	{@render children()}
</Docs>
