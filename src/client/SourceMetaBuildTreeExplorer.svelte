<script lang="ts">
	import {filter_selected_metas} from './source_tree.js';
	import type {SourceTree} from 'src/client/source_tree.js';
	import {get_project_state} from './project_state.js';
	import FileTreeExplorerFolder from './FileTreeExplorerFolder.svelte';
	import {to_file_tree_folder} from './file_tree.js';

	export let source_tree: SourceTree;
	export let selected_build_names: string[];
	export const selected_source_meta = undefined;
	export const hovered_source_meta = undefined;

	const project = get_project_state();

	$: filtered_source_metas = filter_selected_metas(source_tree, selected_build_names);
	$: file_tree_folder = to_file_tree_folder($project.source_dir, filtered_source_metas);
</script>

<div class="build-explorer">
	{#if filtered_source_metas.length}
		<FileTreeExplorerFolder folder={file_tree_folder} />
	{:else}<small><em>no builds selected</em></small>{/if}
</div>

<style>
	.build-explorer {
		display: flex;
		align-items: stretch;
	}
	/*
		TODO how to style these?
		these global selectors are just a hacky to get things working.
		might need to redesign concepts to avoid the complex selector logic to get styles right.
	 */
	.build-explorer :global(ul) {
		padding: 0;
		list-style: none;
		background-color: var(--color_bg_layer);
	}
	.build-explorer :global(li.folder) {
		padding: var(--spacing_sm);
		display: flex;
		align-items: center;
	}
	.build-explorer :global(.node) {
		display: flex;
		align-items: center;
		padding: 0 var(--spacing_sm);
	}
	.build-explorer :global(li.folder > .node) {
		padding-left: 0;
	}
</style>
