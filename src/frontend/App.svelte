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
		hide filer visualizer 1
	{:else}show filer visualizer 1{/if}</button>

<button on:click={() => (showFilerVisualizer2 = !showFilerVisualizer2)}>{#if showFilerVisualizer2}
		hide filer visualizer 2
	{:else}show filer visualizer 2{/if}</button>

{#if showFilerVisualizer2}
	<div in:fade>
		<FilerVisualizer />
	</div>
{/if}
{#if showFilerVisualizer1}
	<div in:fade>
		<FilerVisualizer />
	</div>
{/if}

<style>
	main {
		background: black;
		color: darkgoldenrod;
	}
</style>
