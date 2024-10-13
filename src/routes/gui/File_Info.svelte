<script lang="ts">
	import Details from '@ryanatkn/fuz/Details.svelte';
	import Dialog from '@ryanatkn/fuz/Dialog.svelte';
	import Copy_To_Clipboard from '@ryanatkn/fuz/Copy_To_Clipboard.svelte';

	import type {Source_File} from '../../lib/filer.js';

	interface Props {
		// TODO more efficient data structures, reactive source files
		file: Source_File;
	}

	const {file}: Props = $props();

	const dependencies = $derived(Array.from(file.dependencies.values()));
	const dependents = $derived(Array.from(file.dependents.values()));

	// TODO refactor, can't import `to_base_path` at the moment on the client
	const to_base_path = (path: string) => '/src/' + path.split('/src/')[1];

	let show_dialog = $state(false);
</script>

<button type="button">{file.id}</button>

deps ({dependencies.length} dependencies, {dependents.length} dependents)
<h2>dependencies</h2>
<div class="dep_list">
	{#each dependencies as dependency (dependency.id)}
		<div>{dependency.id}</div>
	{/each}
</div>
<h2>
	{#if !dependents.length}no{' '}{/if}dependents
</h2>
{#if dependents.length > 0}
	<div class="dep_list">
		{#each dependents as dependent (dependent.id)}
			<button type="button" onclick={() => (show_dialog = true)}
				>{to_base_path(dependent.id)}</button
			>
		{/each}
	</div>
{/if}

<div class="row">
	<Copy_To_Clipboard text={file.contents} />
	<Details>
		{#snippet summary()}{@render file_contents()}
		{/snippet}
		<div class="flex_1">{file.contents}</div>
	</Details>
</div>

{#if show_dialog}
	<Dialog onclose={() => (show_dialog = false)}>
		<h2>dialog</h2>
		<button type="button" onclick={() => (show_dialog = false)}>close</button>
		{@render file_contents()}
	</Dialog>
{/if}

{#snippet file_contents()}
	contents {#if file.contents === null}
		null
	{:else}
		({file.contents.length} characters)
	{/if}
{/snippet}

<style>
	.dep_list {
		width: 100%;
		display: grid;
		/* TODO make them fill the available space tiling horizontally but not wrapping the widest item.
		This makes them all collapse down on each other.
		*/
		/* grid-template-columns: repeat(auto-fill, minmax(0, 1fr)); */
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 10px;
	}
</style>
