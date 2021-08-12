<script lang="ts">
	import type {Writable} from 'svelte/store';

	import SourceMetaRawItem from './SourceMetaRawItem.svelte';
	import {filter_selected_metas} from './source_tree.js';
	import type {SourceTree} from 'src/client/source_tree.js';
	import type {SourceMeta} from 'src/build/source_meta.js';

	export let source_tree: SourceTree;
	export let selected_build_names: string[];
	export const selected_source_meta = undefined;
	export let hovered_source_meta: Writable<SourceMeta | null>;

	$: filtered_source_metas = filter_selected_metas(source_tree, selected_build_names);
</script>

{#each filtered_source_metas as source_meta (source_meta.cache_id)}
	<SourceMetaRawItem {source_meta} {hovered_source_meta} />
{:else}<small><em>no builds selected</em></small>{/each}
