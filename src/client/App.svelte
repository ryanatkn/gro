<script>
	import {onMount, setContext} from 'svelte';
	import {slide} from 'svelte/transition';
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
	import SourceMetaBuildTree from './SourceMetaBuildTree.svelte';
	import SourceMetaTreeExplorer from './SourceMetaTreeExplorer.svelte';
	import {createSourceTree} from './sourceTree.js';

	export let name;
	console.log('enter App.svelte');

	let sourceMetaItems;
	const rootDir = writable();
	setContext('rootDir', rootDir);
	let sourceTree;
	let selectedBuildNames = [];

	const sourceMetaViews = [
		SourceMetaRaw,
		SourceMetaExpander,
		SourceMetaTable,
		SourceMetaBuildsTable,
		SourceMetaBuildTree,
		SourceMetaTreeExplorer,
	];
	let activeSourceMetaViewIndex = 4;
	$: activeSourceMetaView = sourceMetaViews[activeSourceMetaViewIndex];
	const setActiveSourceMetaView = (view) =>
		(activeSourceMetaViewIndex = sourceMetaViews.indexOf(view)); // TODO handle error?

	const selectedSourceMeta = writable(null);
	const hoveredSourceMeta = writable(null);

	onMount(async () => {
		const SOURCE_META_PATH = '/src'; // TODO move, share with `src/server/server.ts`
		const result = await (await fetch(SOURCE_META_PATH)).json();
		sourceMetaItems = result.items;
		$rootDir = result.rootDir; // TODO import paths instead, probably
		console.log('rootDir', $rootDir);
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

<div class="app">
	<section>
		{name}
		<button
			on:pointerdown={() => (showFilerVisualizer1 = !showFilerVisualizer1)}
		>{#if showFilerVisualizer1}
				hide server filer visualizer
			{:else}show server filer visualizer{/if}</button>

		<button
			on:pointerdown={() => (showFilerVisualizer2 = !showFilerVisualizer2)}
		>{#if showFilerVisualizer2}
				hide client example filer visualizer
			{:else}show client example filer visualizer{/if}</button>
	</section>

	{#if showFilerVisualizer1}
		<section transition:slide>
			<FilerVisualizer name="server" />
		</section>
	{/if}
	{#if showFilerVisualizer2}
		<section transition:slide>
			<FilerVisualizer name="client example" />
		</section>
	{/if}
	{#if showServerVisualizer}
		<section transition:slide>
			<ServerVisualizer name="gro dev server" />
		</section>
	{/if}
	{#if showSourceTreeVisualizer}
		<section transition:slide>
			<SourceTreeVisualizer name="source tree" />
		</section>
	{/if}
	{#if showBuildTreeVisualizer}
		<section transition:slide>
			<BuildTreeVisualizer name="build tree" />
		</section>
	{/if}

	<section transition:slide>
		{#if showSourceMeta}
			<nav>
				<button on:pointerdown={() => (showSourceMeta = false)}>🗙</button>
				{#each sourceMetaViews as sourceMetaView (sourceMetaView.name)}
					<button
						on:pointerdown={() => setActiveSourceMetaView(sourceMetaView)}
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
		{:else}<button on:pointerdown={() => (showSourceMeta = true)}>show source meta</button>{/if}
	</section>
</div>

<style>
	.app {
		/* TODO */
		--color_bg: rgb(210, 219, 209);
		--color_fg: #fff;
		--color_bg_layer: rgba(1, 0, 0, 0.13);
		--color_text: rgb(11, 3, 3);
		--color_0: #40a060;
		--color_1: #495499;
		--color_2: #997649;
		--color_0_text: #2f5e3f;
		--color_1_text: #3a4069;
		--color_2_text: #5f4c34;
		--spacing_sm: 5px;
		--spacing_md: 10px;

		height: 100%;
		overflow-y: scroll; /* for Windows behavior */
		overflow-x: auto;
		position: relative;
		background-color: var(--color_bg);
	}

	.active {
		background: transparent;
	}

	section {
		background-color: var(--color_fg);
		margin-bottom: var(--spacing_sm);
		/* TODO add `0` to left/right - padding should be left to another class */
		padding: var(--spacing_sm);
	}
</style>
