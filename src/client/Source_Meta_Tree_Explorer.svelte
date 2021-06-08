<script lang="ts">
	import {filter_selected_metas} from './source_tree.js';
	import type {Source_Tree} from './source_tree.js';
	import {to_file_tree_folder} from './file_tree.js';
	import File_Tree_Explorer_Folder from './File_Tree_Explorer_Folder.svelte';
	import {use_project_state} from './project_state.js';

	export let source_tree: Source_Tree;
	export let selected_build_names: string[];
	export const selected_source_meta = undefined;
	export const hovered_source_meta = undefined;

	const ps = use_project_state();

	$: filteredSource_Metas = filter_selected_metas(source_tree, selected_build_names);
	$: file_treeFolder = to_file_tree_folder($ps.source_dir, filteredSource_Metas);
</script>

<div class="explorer">
	{#if filteredSource_Metas.length}
		<File_Tree_Explorer_Folder folder={file_treeFolder} />
	{:else}<small><em>no builds selected</em></small>{/if}
</div>

<style>
	.explorer {
		display: flex;
		flex-direction: column;
		align-items: stretch;
	}
</style>
