<script lang="ts">
	import DocsContent from '@ryanatkn/fuz/DocsContent.svelte';
	import {tomes_context} from '@ryanatkn/fuz/tome.js';
	import {pkg_context} from '@ryanatkn/fuz/pkg.svelte.js';

	const tomes_by_name = tomes_context.get();

	const tomes = Array.from(tomes_by_name.values());

	const pkg = pkg_context.get();
</script>

<DocsContent {tomes} {pkg}>
	{#snippet repo_name()}
		<h1 class="mb_sm">gro</h1>
	{/snippet}
</DocsContent>
