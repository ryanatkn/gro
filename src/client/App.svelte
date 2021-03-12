<script>
	import {onMount, setContext} from 'svelte';
	import {slide} from 'svelte/transition';
	import {writable} from 'svelte/store';

	import FilerVisualizer from './FilerVisualizer.svelte';
	import ServerVisualizer from './ServerVisualizer.svelte';
	import ViewName from './ViewName.svelte';
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
	let sourceTree;
	let selectedBuildNames = [];

	// TODO refactor (at minimum, use an imported context key)
	const buildContext = writable();
	setContext('buildContext', buildContext);

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
		$buildContext = {buildDir: result.buildDir, sourceDir: result.sourceDir};
		console.log('buildContext', $buildContext);
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
		<header>
			<span class="logo"> {name} </span>
			<nav>
				{#if !showFilerVisualizer1}
					<!-- server filer visualizer -->
					<button on:pointerdown={() => (showFilerVisualizer1 = !showFilerVisualizer1)}>
						FilerVisualizer (server)
					</button>
				{/if}
				{#if !showFilerVisualizer2}
					<!-- client example filer visualizer -->
					<button on:pointerdown={() => (showFilerVisualizer2 = !showFilerVisualizer2)}>
						FilerVisualizer (client)
					</button>
				{/if}
				{#if !showServerVisualizer}
					<!-- gro dev server filer visualizer -->
					<button on:pointerdown={() => (showServerVisualizer = !showServerVisualizer)}>
						ServerVisualizer
					</button>
				{/if}
				{#if !showSourceTreeVisualizer}
					<!-- source tree visualizer -->
					<button on:pointerdown={() => (showSourceTreeVisualizer = !showSourceTreeVisualizer)}>
					SourceTreeVisualizer
				</button>
				{/if}
				{#if !showBuildTreeVisualizer}
					<!-- build tree visualizer -->
					<button on:pointerdown={() => (showBuildTreeVisualizer = !showBuildTreeVisualizer)}>
						BuildTreeVisualizer
					</button>
				{/if}
			</nav>
		</header>
	</section>

	{#if showFilerVisualizer1}
		<section transition:slide>
			<button on:pointerdown={() => (showFilerVisualizer1 = false)}>🗙</button>
			<ViewName view={FilerVisualizer} />
			<FilerVisualizer name="server" />
		</section>
	{/if}
	{#if showFilerVisualizer2}
		<section transition:slide>
			<button on:pointerdown={() => (showFilerVisualizer2 = false)}>🗙</button>
			<ViewName view={FilerVisualizer} />
			<FilerVisualizer name="client example" />
		</section>
	{/if}
	{#if showServerVisualizer}
		<section transition:slide>
			<button on:pointerdown={() => (showServerVisualizer = false)}>🗙</button>
			<ViewName view={ServerVisualizer} />
			<ServerVisualizer name="gro dev server" />
		</section>
	{/if}
	{#if showSourceTreeVisualizer}
		<section transition:slide>
			<button on:pointerdown={() => (showSourceTreeVisualizer = false)}>🗙</button>
			<ViewName view={SourceTreeVisualizer} />
			<SourceTreeVisualizer name="source tree" />
		</section>
	{/if}
	{#if showBuildTreeVisualizer}
		<section transition:slide>
			<button on:pointerdown={() => (showBuildTreeVisualizer = false)}>🗙</button>
			<ViewName view={BuildTreeVisualizer} />
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
		--color_fg: #fff;
		--color_bg_layer: rgba(1, 0, 0, 0.13);
		--color_text: hsl(0, 57%, 3%);
		--color_felt: hsl(112, 35%, 44%);
		--color_0: hsl(112, 43%, 44%);
		--color_1: hsl(202, 35%, 44%);
		--color_2: hsl(33, 35%, 44%);
		--color_3: hsl(272, 39%, 44%);
		--color_0_text: hsl(112, 33%, 28%);
		--color_1_text: hsl(202, 29%, 32%);
		--color_2_text: hsl(33, 29%, 29%);
		--color_3_text: hsl(272, 31%, 30%);
		--color_0_bg: hsl(112, 30%, 91%);
		--color_1_bg: hsl(202, 30%, 91%);
		--color_2_bg: hsl(33, 30%, 91%);
		--color_3_bg: hsl(272, 30%, 91%);
		--spacing_sm: 5px;
		--spacing_md: 10px;
		--spacing_height_md: 24px;

		height: 100%;
		overflow-y: scroll; /* for Windows behavior */
		overflow-x: auto;
		position: relative;
		background-color: var(--color_2_bg);
	}

	.active {
		background: transparent;
	}

	header {
		display: flex;
		align-items: center;
	}

	.logo {
		padding-right: var(--spacing_sm);
	}

	nav {
		display: flex;
		align-items: center;
	}

	section {
		background-color: var(--color_fg);
		margin-bottom: var(--spacing_sm);
		/* TODO add `0` to left/right - padding should be left to another class */
		padding: var(--spacing_sm);
	}
</style>
