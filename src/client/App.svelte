<script>
	import {onMount} from 'svelte';
	import {fade} from 'svelte/transition';
	import {writable} from 'svelte/store';

	import FilerVisualizer from './FilerVisualizer.svelte';
	import ServerVisualizer from './ServerVisualizer.svelte';
	import SourceTreeVisualizer from './SourceTreeVisualizer.svelte';
	import BuildTreeVisualizer from './BuildTreeVisualizer.svelte';
	import SourceMetaRaw from './SourceMetaRaw.svelte';
	import SourceMetaExpander from './SourceMetaExpander.svelte';
	import SourceMetaTable from './SourceMetaTable.svelte';
	import SourceMetaTreeExplorer from './SourceMetaTreeExplorer.svelte';
	import {createSourceTree} from './sourceTree.js';

	export let name;
	console.log('enter App.svelte');

	let sourceMetaItems;
	let sourceTree;
	let selectedBuildNames = [];

	const sourceMetaViews = [
		SourceMetaRaw,
		SourceMetaExpander,
		SourceMetaTable,
		SourceMetaTreeExplorer,
	];
	let activeSourceMetaViewIndex = 1;
	$: activeSourceMetaView = sourceMetaViews[activeSourceMetaViewIndex];
	const setActiveSourceMetaView = (view) =>
		(activeSourceMetaViewIndex = sourceMetaViews.indexOf(view)); // TODO handle error?

	const selectedSourceMeta = writable(null);
	const hoveredSourceMeta = writable(null);

	onMount(async () => {
		const SOURCE_META_PATH = '/src'; // TODO move, share with `src/server/server.ts`
		sourceMetaItems = await (await fetch(SOURCE_META_PATH)).json();
		console.log('sourceMetaItems', sourceMetaItems);
		sourceTree = createSourceTree(sourceMetaItems);
		selectedBuildNames = sourceTree.buildNames;
		console.log('sourceTree', sourceTree);
	});

	let showFilerVisualizer1 = false;
	let showFilerVisualizer2 = false;
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

<nav>
	{#each sourceMetaViews as sourceMetaView (sourceMetaView.name)}
		<button
			on:click={() => setActiveSourceMetaView(sourceMetaView)}
			class:active={sourceMetaView === activeSourceMetaView}
		>
			{sourceMetaView.name}
		</button>
	{/each}
</nav>
<div class="source-meta">
	{#if sourceTree}
		<form>
			{#each sourceTree.buildNames as buildName (buildName)}
				<div>
					<label>
						<input type="checkbox" bind:group={selectedBuildNames} value={buildName} />
						{buildName}
						({sourceTree.metaByBuildName.get(buildName).length})
					</label>
				</div>
			{/each}
		</form>
		<svelte:component
			this={activeSourceMetaView}
			{sourceTree}
			{selectedSourceMeta}
			{hoveredSourceMeta}
			{selectedBuildNames}
		/>
	{:else}loading...{/if}
</div>

<style>
	main {
		background: black;
		color: darkgoldenrod;
	}
	.active {
		background: transparent;
	}
</style>
