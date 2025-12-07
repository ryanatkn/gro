<script lang="ts">
	import type {Snippet} from 'svelte';
	import Docs from '@fuzdev/fuz_ui/Docs.svelte';
	import {library_context} from '@fuzdev/fuz_ui/library.svelte.js';

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
