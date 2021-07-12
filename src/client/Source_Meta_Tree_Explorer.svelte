<script lang="ts">
	import {filter_selected_metas} from './source_tree.js';
	import type {Source_Tree} from 'src/client/source_tree.js';
	import {to_file_tree_folder} from './file_tree.js';
	import File_Tree_Explorer_Folder from './File_Tree_Explorer_Folder.svelte';
	import {get_project_state} from './project_state.js';

	export let source_tree: Source_Tree;
	export let selected_build_names: string[];
	export const selected_source_meta = undefined;
	export const hovered_source_meta = undefined;

	const project = get_project_state();

	$: filtered_source_metas = filter_selected_metas(source_tree, selected_build_names);
	$: file_tree_folder = to_file_tree_folder($project.source_dir, filtered_source_metas);
</script>

<div class="explorer">
	{#if filtered_source_metas.length}
		<File_Tree_Explorer_Folder folder={file_tree_folder} />
	{:else}<small><em>no builds selected</em></small>{/if}
</div>

<style>
	.explorer {
		display: flex;
		flex-direction: column;
		align-items: stretch;
	}
</style>
