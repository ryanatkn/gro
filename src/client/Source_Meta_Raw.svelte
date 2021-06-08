<script lang="ts">
	import type {Writable} from 'svelte/store';

	import Source_Meta_RawItem from './Source_Meta_RawItem.svelte';
	import {filter_selected_metas} from './source_tree.js';
	import type {Source_Tree} from './source_tree.js';
	import type {Source_Meta} from '../build/source_meta.js';

	export let source_tree: Source_Tree;
	export let selected_build_names: string[];
	export const selected_source_meta = undefined;
	export let hovered_source_meta: Writable<Source_Meta | null>;

	$: filteredSource_Metas = filter_selected_metas(source_tree, selected_build_names);
</script>

{#each filteredSource_Metas as source_meta (source_meta.cache_id)}
	<Source_Meta_RawItem {source_meta} {hovered_source_meta} />
{:else}<small><em>no builds selected</em></small>{/each}
