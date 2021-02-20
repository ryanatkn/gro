<script>
	import {fade} from 'svelte/transition';

	import FilerVisualizer from './FilerVisualizer.svelte';

	export let name;
	console.log('enter App.svelte');

	let showFilerVisualizer1 = false;
	let showFilerVisualizer2 = false;
</script>

<main>name: {name}</main>

<button on:click={() => (showFilerVisualizer1 = !showFilerVisualizer1)}>{#if showFilerVisualizer1}
		hide server filer visualizer
	{:else}show server filer visualizer{/if}</button>

<button on:click={() => (showFilerVisualizer2 = !showFilerVisualizer2)}>{#if showFilerVisualizer2}
		hide client example filer visualizer
	{:else}show client example filer visualizer{/if}</button>

{#if showFilerVisualizer1}
	<div in:fade>
		<FilerVisualizer name="server" />
	</div>
{/if}
{#if showFilerVisualizer2}
	<div in:fade>
		<FilerVisualizer name="client example" />
	</div>
{/if}

<style>
	main {
		background: black;
		color: darkgoldenrod;
	}
</style>
