<script lang="ts">
	import Source_Meta_Build_Tree_Explorer from './Source_Meta_Build_Tree_Explorer.svelte';
	import Source_Meta_Tree_Explorer from './Source_Meta_Tree_Explorer.svelte';
	import type {Source_Tree} from './source_tree.js';

	export let source_tree: Source_Tree;
	export let selected_build_names: string[];
	export const selected_source_meta = undefined;
	export const hovered_source_meta = undefined;
</script>

<div class="explorers">
	<Source_Meta_Build_Tree_Explorer {source_tree} {selected_build_names} />
	<Source_Meta_Tree_Explorer {source_tree} {selected_build_names} />
</div>

<style>
	.explorers {
		display: flex;
	}
</style>
