<script lang="ts">
	import DocsContent from '@ryanatkn/fuz/DocsContent.svelte';
	import {tomes_context} from '@ryanatkn/fuz/tome.js';
	import {library_context} from '@ryanatkn/fuz/library.svelte.js';

	const tomes_by_name = tomes_context.get();

	const tomes = Array.from(tomes_by_name.values());

	const library = library_context.get();
</script>

<DocsContent {tomes} {library}>
	{#snippet repo_name()}
		<h1 class="mb_sm">gro</h1>
	{/snippet}
</DocsContent>
