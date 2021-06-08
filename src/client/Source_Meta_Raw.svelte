<script lang="ts">
	import type {Writable} from 'svelte/store';

	import SourceMetaRawItem from './SourceMetaRawItem.svelte';
	import {filterSelectedMetas} from './sourceTree.js';
	import type {SourceTree} from './sourceTree.js';
	import type {SourceMeta} from '../build/source_meta.js';

	export let sourceTree: SourceTree;
	export let selectedBuild_Names: string[];
	export const selectedSourceMeta = undefined;
	export let hoveredSourceMeta: Writable<SourceMeta | null>;

	$: filteredSourceMetas = filterSelectedMetas(sourceTree, selectedBuild_Names);
</script>

{#each filteredSourceMetas as source_meta (source_meta.cacheId)}
	<SourceMetaRawItem {source_meta} {hoveredSourceMeta} />
{:else}<small><em>no builds selected</em></small>{/each}
