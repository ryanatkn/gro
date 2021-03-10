<script>
	import {onMount} from 'svelte';
	import {fade} from 'svelte/transition';

	import FilerVisualizer from './FilerVisualizer.svelte';
	import ServerVisualizer from './ServerVisualizer.svelte';
	import SourceTreeVisualizer from './SourceTreeVisualizer.svelte';
	import BuildTreeVisualizer from './BuildTreeVisualizer.svelte';
	import SourceMetaDataRaw from './SourceMetaDataRaw.svelte';

	export let name;
	console.log('enter App.svelte');

	let sourceMeta;

	onMount(async () => {
		const SOURCE_META_PATH = '/src'; // TODO move, share with `src/server/server.ts`
		const srcMeta = await (await fetch(SOURCE_META_PATH)).json();
		console.log('srcMeta', srcMeta);
		sourceMeta = srcMeta;
	});

	let showFilerVisualizer1 = true;
	let showFilerVisualizer2 = true;
	let showServerVisualizer = true;
	let showSourceTreeVisualizer = true;
	let showBuildTreeVisualizer = true;
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
{#if showServerVisualizer}
	<div in:fade>
		<ServerVisualizer name="gro dev server" />
	</div>
{/if}
{#if showSourceTreeVisualizer}
	<div in:fade>
		<SourceTreeVisualizer name="source tree" />
	</div>
{/if}
{#if showBuildTreeVisualizer}
	<div in:fade>
		<BuildTreeVisualizer name="build tree" />
	</div>
{/if}

<div class="source-meta">
	{#if sourceMeta}
		{#each sourceMeta as sourceMetaData}
			<SourceMetaDataRaw {sourceMetaData} />
		{/each}
	{:else}loading...{/if}
</div>

<style>
	main {
		background: black;
		color: darkgoldenrod;
	}
</style>
