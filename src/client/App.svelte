<script lang="ts">
	import {onMount} from 'svelte';
	import {slide} from 'svelte/transition';
	import {writable} from 'svelte/store';

	import FilerVisualizer from './FilerVisualizer.svelte';
	import ServerVisualizer from './ServerVisualizer.svelte';
	import ViewName from './ViewName.svelte';
	import SourceTreeVisualizer from './SourceTreeVisualizer.svelte';
	import BuildTreeVisualizer from './BuildTreeVisualizer.svelte';
	import SourceMetaView from './SourceMetaView.svelte';
	import SourceMetaRaw from './SourceMetaRaw.svelte';
	import SourceMetaExpander from './SourceMetaExpander.svelte';
	import SourceMetaTable from './SourceMetaTable.svelte';
	import SourceMetaBuildsTable from './SourceMetaBuildsTable.svelte';
	import SourceMetaBuildTree from './SourceMetaBuildTree.svelte';
	import SourceMetaBuildTreeExplorer from './SourceMetaBuildTreeExplorer.svelte';
	import SourceMetaTreeExplorer from './SourceMetaTreeExplorer.svelte';
	import SourceMetaTreeExplorers from './SourceMetaTreeExplorers.svelte';
	import {create_source_tree} from './source_tree.js';
	import type {SourceTree} from 'src/client/source_tree.js';
	import type {ProjectState} from 'src/server/project_state.js';
	import type {View} from 'src/client/view.js';
	import {set_project_state} from './project_state.js';

	console.log('enter App.svelte');

	$: homepage = ($ctx?.package_json.homepage || '') as string;
	let source_tree: SourceTree;
	let selected_build_names: string[] = [];

	const ctx = writable<ProjectState>(null!);
	set_project_state(ctx);

	const source_meta_views: View[] = [
		SourceMetaRaw,
		SourceMetaExpander,
		SourceMetaTable,
		SourceMetaBuildsTable,
		SourceMetaBuildTree,
		SourceMetaBuildTreeExplorer,
		SourceMetaTreeExplorer,
		SourceMetaTreeExplorers,
	];
	let active_source_meta_view_index = 7;
	$: active_source_meta_view = source_meta_views[active_source_meta_view_index];
	const set_active_source_meta_view = (view: View) =>
		(active_source_meta_view_index = source_meta_views.indexOf(view)); // TODO handle error?

	const selected_source_meta = writable(null);
	const hovered_source_meta = writable(null);

	onMount(async () => {
		const SOURCE_META_PATH = '/src'; // TODO move, share with `src/server/server.ts`
		$ctx = await (await fetch(SOURCE_META_PATH)).json(); // TODO handle errors
		console.log('fetched project_state', $ctx);
		source_tree = create_source_tree($ctx.items, $ctx.build_configs);
		selected_build_names = source_tree.build_names;
		console.log('source_tree', source_tree);
	});

	let show_source_meta = true;
	let show_filer_visualizer1 = false;
	let show_filer_visualizer2 = false;
	let show_server_visualizer = false;
	let show_source_tree_visualizer = false;
	let show_build_tree_visualizer = false;
</script>

<div class="app">
	{#if source_tree}
		<section>
			<header>
				<span class="logo">
					{#if $ctx.package_json.homepage}
						<a href={homepage}>{$ctx.package_json.name}</a>
					{:else}{$ctx.package_json.name}{/if}
				</span>
				<nav>
					{#if !show_filer_visualizer1}
						<!-- server filer visualizer -->
						<button on:pointerdown={() => (show_filer_visualizer1 = !show_filer_visualizer1)}>
							FilerVisualizer (server)
						</button>
					{/if}
					{#if !show_filer_visualizer2}
						<!-- client example filer visualizer -->
						<button on:pointerdown={() => (show_filer_visualizer2 = !show_filer_visualizer2)}>
							FilerVisualizer (client)
						</button>
					{/if}
					{#if !show_server_visualizer}
						<!-- gro dev server filer visualizer -->
						<button on:pointerdown={() => (show_server_visualizer = !show_server_visualizer)}>
							ServerVisualizer
						</button>
					{/if}
					{#if !show_source_tree_visualizer}
						<!-- source tree visualizer -->
						<button
							on:pointerdown={() => (show_source_tree_visualizer = !show_source_tree_visualizer)}
						>
							SourceTreeVisualizer
						</button>
					{/if}
					{#if !show_build_tree_visualizer}
						<!-- build tree visualizer -->
						<button
							on:pointerdown={() => (show_build_tree_visualizer = !show_build_tree_visualizer)}
						>
							BuildTreeVisualizer
						</button>
					{/if}
				</nav>
			</header>
		</section>

		{#if show_filer_visualizer1}
			<section transition:slide>
				<button on:pointerdown={() => (show_filer_visualizer1 = false)}>🗙</button>
				<ViewName view={FilerVisualizer} />
				<FilerVisualizer name="server" />
			</section>
		{/if}
		{#if show_filer_visualizer2}
			<section transition:slide>
				<button on:pointerdown={() => (show_filer_visualizer2 = false)}>🗙</button>
				<ViewName view={FilerVisualizer} />
				<FilerVisualizer name="client example" />
			</section>
		{/if}
		{#if show_server_visualizer}
			<section transition:slide>
				<button on:pointerdown={() => (show_server_visualizer = false)}>🗙</button>
				<ViewName view={ServerVisualizer} />
				<ServerVisualizer name="gro dev server" />
			</section>
		{/if}
		{#if show_source_tree_visualizer}
			<section transition:slide>
				<button on:pointerdown={() => (show_source_tree_visualizer = false)}>🗙</button>
				<ViewName view={SourceTreeVisualizer} />
				<SourceTreeVisualizer name="source tree" />
			</section>
		{/if}
		{#if show_build_tree_visualizer}
			<section transition:slide>
				<button on:pointerdown={() => (show_build_tree_visualizer = false)}>🗙</button>
				<ViewName view={BuildTreeVisualizer} />
				<BuildTreeVisualizer name="build tree" />
			</section>
		{/if}

		<section>
			{#if show_source_meta}
				<nav>
					<button on:pointerdown={() => (show_source_meta = false)}>🗙</button>
					{#each source_meta_views as source_metaView (source_metaView.name)}
						<button
							on:pointerdown={() => set_active_source_meta_view(source_metaView)}
							class:active={source_metaView === active_source_meta_view}
							disabled={source_metaView === active_source_meta_view}
						>
							{source_metaView.name}
						</button>
					{/each}
				</nav>

				<SourceMetaView
					{source_tree}
					{selected_build_names}
					{active_source_meta_view}
					{selected_source_meta}
					{hovered_source_meta}
				/>
			{:else}<button on:pointerdown={() => (show_source_meta = true)}>show source meta</button>{/if}
		</section>
	{:else}
		<div class="loading">...</div>
	{/if}
</div>

<style>
	.app {
		/* TODO */
		--color_fg: #fff;
		--color_bg_layer: rgba(1, 0, 0, 0.08);
		--color_text: hsl(0, 57%, 3%);
		--color_felt: hsl(112, 35%, 44%);
		--color_0: hsl(112, 43%, 44%);
		--color_1: hsl(202, 35%, 44%);
		--color_2: hsl(33, 35%, 44%);
		--color_3: hsl(272, 39%, 44%);
		--color_4: hsl(166, 35%, 44%);
		--color_0_text: hsl(112, 33%, 28%);
		--color_1_text: hsl(202, 29%, 32%);
		--color_2_text: hsl(33, 29%, 29%);
		--color_3_text: hsl(272, 31%, 30%);
		--color_4_text: hsl(166, 29%, 29%);
		--color_0_bg: hsl(112, 30%, 91%);
		--color_1_bg: hsl(202, 30%, 91%);
		--color_2_bg: hsl(33, 30%, 91%);
		--color_3_bg: hsl(272, 30%, 91%);
		--color_4_bg: hsl(166, 30%, 91%);
		--spacing_xs: 3px;
		--spacing_sm: 6px;
		--spacing_md: 12px;
		--spacing_height_md: 24px;

		height: 100%;
		overflow-y: scroll; /* for Windows behavior */
		overflow-x: auto;
		position: relative;
		background-color: var(--color_2_bg);
	}

	.loading {
		text-align: center;
		opacity: 0.6;
		font-size: 7em;
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
		flex-wrap: wrap;
	}

	section {
		background-color: var(--color_fg);
		margin-bottom: var(--spacing_sm);
		/* TODO add `0` to left/right - padding should be left to another class */
		padding: var(--spacing_sm);
	}
</style>
