<script lang="ts">
	import type {Writable} from 'svelte/store';

	import Source_Meta_Expander_Item from './Source_Meta_Expander_Item.svelte';
	import {filter_selected_metas} from './source_tree.js';
	import type {Source_Tree} from 'src/client/source_tree.js';
	import type {Source_Meta} from 'src/build/source_meta.js';

	export let source_tree: Source_Tree;
	export let selected_build_names: string[];
	export let selected_source_meta: Writable<Source_Meta | null>;
	export let hovered_source_meta: Writable<Source_Meta | null>;

	$: filtered_source_metas = filter_selected_metas(source_tree, selected_build_names);
</script>

{#each filtered_source_metas as source_meta (source_meta.cache_id)}
	<Source_Meta_Expander_Item {source_meta} {selected_source_meta} {hovered_source_meta} />
{:else}<small><em>no builds selected</em></small>{/each}
