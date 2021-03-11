<script>
	import {onMount} from 'svelte';
	import {fade} from 'svelte/transition';
	import {writable} from 'svelte/store';

	import FilerVisualizer from './FilerVisualizer.svelte';
	import ServerVisualizer from './ServerVisualizer.svelte';
	import SourceTreeVisualizer from './SourceTreeVisualizer.svelte';
	import BuildTreeVisualizer from './BuildTreeVisualizer.svelte';
	import SourceMeta from './SourceMeta.svelte';
	import SourceMetaRaw from './SourceMetaRaw.svelte';
	import SourceMetaExpander from './SourceMetaExpander.svelte';
	import SourceMetaTable from './SourceMetaTable.svelte';
	import SourceMetaBuildsTable from './SourceMetaBuildsTable.svelte';
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
		SourceMetaBuildsTable,
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

	let showSourceMeta = true;
	let showFilerVisualizer1 = false;
	let showFilerVisualizer2 = false;
	let showServerVisualizer = true;
	let showSourceTreeVisualizer = true;
	let showBuildTreeVisualizer = true;
</script>

<main>
	<div class="pane">
		{name}
		<button
			on:click={() => (showFilerVisualizer1 = !showFilerVisualizer1)}
		>{#if showFilerVisualizer1}
				hide server filer visualizer
			{:else}show server filer visualizer{/if}</button>

		<button
			on:click={() => (showFilerVisualizer2 = !showFilerVisualizer2)}
		>{#if showFilerVisualizer2}
				hide client example filer visualizer
			{:else}show client example filer visualizer{/if}</button>
	</div>

	{#if showFilerVisualizer1}
		<div class="pane" in:fade>
			<FilerVisualizer name="server" />
		</div>
	{/if}
	{#if showFilerVisualizer2}
		<div class="pane" in:fade>
			<FilerVisualizer name="client example" />
		</div>
	{/if}
	{#if showServerVisualizer}
		<div class="pane" in:fade>
			<ServerVisualizer name="gro dev server" />
		</div>
	{/if}
	{#if showSourceTreeVisualizer}
		<div class="pane" in:fade>
			<SourceTreeVisualizer name="source tree" />
		</div>
	{/if}
	{#if showBuildTreeVisualizer}
		<div class="pane" in:fade>
			<BuildTreeVisualizer name="build tree" />
		</div>
	{/if}

	<div class="pane" in:fade>
		{#if showSourceMeta}
			<nav>
				<button on:click={() => (showSourceMeta = false)}>🗙</button>
				{#each sourceMetaViews as sourceMetaView (sourceMetaView.name)}
					<button
						on:click={() => setActiveSourceMetaView(sourceMetaView)}
						class:active={sourceMetaView === activeSourceMetaView}
						disabled={sourceMetaView === activeSourceMetaView}
					>
						{sourceMetaView.name}
					</button>
				{/each}
			</nav>

			{#if sourceTree}
				<SourceMeta
					{sourceTree}
					{selectedBuildNames}
					{activeSourceMetaView}
					{selectedSourceMeta}
					{hoveredSourceMeta}
				/>
			{:else}loading...{/if}
		{:else}<button on:click={() => (showSourceMeta = true)}>show source meta</button>{/if}
	</div>
</main>

<style>
	main {
		/* TODO */
		--bg_color: #fff;
		--fg_color: #fff;

		background-color: var(--bg_color);
	}

	.active {
		background: transparent;
	}

	.pane {
		background-color: var(--fg_color);
		margin: 5px;
		padding: 5px;
		border: 1px solid #ddd;
		border-radius: 3px;
	}
</style>
