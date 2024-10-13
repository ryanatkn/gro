<script lang="ts">
	import Details from '@ryanatkn/fuz/Details.svelte';
	import Copy_To_Clipboard from '@ryanatkn/fuz/Copy_To_Clipboard.svelte';

	import type {Source_File} from '../../lib/filer.js';

	interface Props {
		// TODO more efficient data structures, reactive source files
		file: Source_File;
	}

	const {file}: Props = $props();

	const dependencies = $derived(Array.from(file.dependencies.values()));
	const dependents = $derived(Array.from(file.dependents.values()));
</script>

<button type="button">{file.id}</button>
<Copy_To_Clipboard text={file.contents} />
<Details>
	{#snippet summary()}contents {#if file.contents === null}
			null
		{:else}
			({file.contents.length} characters)
		{/if}
	{/snippet}
	<div class="flex_1">{file.contents}</div>
</Details>
<Details>
	{#snippet summary()}
		deps ({dependencies.length} dependencies, {dependents.length} dependents)
	{/snippet}
	<h2>dependencies</h2>
	{#each dependencies as dependency (dependency.id)}
		<button type="button">{dependency}</button>
	{/each}
	<h2>dependents</h2>
	{#each dependents as dependent (dependent.id)}
		<button type="button">{dependent}</button>
	{/each}
</Details>
