<script lang="ts">
	import {onMount} from 'svelte';
	import {slide} from 'svelte/transition';
	import {writable} from 'svelte/store';

	import Filer_Visualizer from './Filer_Visualizer.svelte';
	import Server_Visualizer from './Server_Visualizer.svelte';
	import View_Name from './View_Name.svelte';
	import Source_Tree_Visualizer from './Source_Tree_Visualizer.svelte';
	import Build_Tree_Visualizer from './Build_Tree_Visualizer.svelte';
	import Source_Meta_View from './Source_Meta_View.svelte';
	import Source_Meta_Raw from './Source_Meta_Raw.svelte';
	import Source_Meta_Expander from './Source_Meta_Expander.svelte';
	import Source_Meta_Table from './Source_Meta_Table.svelte';
	import Source_Meta_Builds_Table from './Source_Meta_Builds_Table.svelte';
	import Source_Meta_Build_Tree from './Source_Meta_Build_Tree.svelte';
	import Source_Meta_Build_Tree_Explorer from './Source_Meta_Build_Tree_Explorer.svelte';
	import Source_Meta_Tree_Explorer from './Source_Meta_Tree_Explorer.svelte';
	import Source_Meta_Tree_Explorers from './Source_Meta_Tree_Explorers.svelte';
	import {create_source_tree} from './source_tree.js';
	import type {Source_Tree} from './source_tree.js';
	import type {Project_State} from '../server/project_state.js';
	import type {View} from './view.js';
	import {set_project_state} from './project_state.js';

	console.log('enter App.svelte');

	$: homepage = ($ctx?.package_json.homepage || '') as string;
	let source_tree: Source_Tree;
	let selected_build_names: string[] = [];

	const ctx = writable<Project_State>(null!);
	set_project_state(ctx);

	const source_meta_views: View[] = [
		Source_Meta_Raw,
		Source_Meta_Expander,
		Source_Meta_Table,
		Source_Meta_Builds_Table,
		Source_Meta_Build_Tree,
		Source_Meta_Build_Tree_Explorer,
		Source_Meta_Tree_Explorer,
		Source_Meta_Tree_Explorers,
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
							Filer_Visualizer (server)
						</button>
					{/if}
					{#if !show_filer_visualizer2}
						<!-- client example filer visualizer -->
						<button on:pointerdown={() => (show_filer_visualizer2 = !show_filer_visualizer2)}>
							Filer_Visualizer (client)
						</button>
					{/if}
					{#if !show_server_visualizer}
						<!-- gro dev server filer visualizer -->
						<button on:pointerdown={() => (show_server_visualizer = !show_server_visualizer)}>
							Server_Visualizer
						</button>
					{/if}
					{#if !show_source_tree_visualizer}
						<!-- source tree visualizer -->
						<button
							on:pointerdown={() => (show_source_tree_visualizer = !show_source_tree_visualizer)}
						>
							Source_Tree_Visualizer
						</button>
					{/if}
					{#if !show_build_tree_visualizer}
						<!-- build tree visualizer -->
						<button
							on:pointerdown={() => (show_build_tree_visualizer = !show_build_tree_visualizer)}
						>
							Build_Tree_Visualizer
						</button>
					{/if}
				</nav>
			</header>
		</section>

		{#if show_filer_visualizer1}
			<section transition:slide>
				<button on:pointerdown={() => (show_filer_visualizer1 = false)}>🗙</button>
				<View_Name view={Filer_Visualizer} />
				<Filer_Visualizer name="server" />
			</section>
		{/if}
		{#if show_filer_visualizer2}
			<section transition:slide>
				<button on:pointerdown={() => (show_filer_visualizer2 = false)}>🗙</button>
				<View_Name view={Filer_Visualizer} />
				<Filer_Visualizer name="client example" />
			</section>
		{/if}
		{#if show_server_visualizer}
			<section transition:slide>
				<button on:pointerdown={() => (show_server_visualizer = false)}>🗙</button>
				<View_Name view={Server_Visualizer} />
				<Server_Visualizer name="gro dev server" />
			</section>
		{/if}
		{#if show_source_tree_visualizer}
			<section transition:slide>
				<button on:pointerdown={() => (show_source_tree_visualizer = false)}>🗙</button>
				<View_Name view={Source_Tree_Visualizer} />
				<Source_Tree_Visualizer name="source tree" />
			</section>
		{/if}
		{#if show_build_tree_visualizer}
			<section transition:slide>
				<button on:pointerdown={() => (show_build_tree_visualizer = false)}>🗙</button>
				<View_Name view={Build_Tree_Visualizer} />
				<Build_Tree_Visualizer name="build tree" />
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

				<Source_Meta_View
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
