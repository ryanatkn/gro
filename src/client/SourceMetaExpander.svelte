<script lang="ts">
	import {Writable} from 'svelte/store';

	import SourceMetaExpanderItem from './SourceMetaExpanderItem.svelte';
	import {SourceTree, filterSelectedMetaItems} from './sourceTree.js';
	import {SourceMeta} from '../build/sourceMeta.js';

	export let sourceTree: SourceTree;
	export let selectedBuildNames: string[];
	export let selectedSourceMeta: Writable<SourceMeta | null>;
	export let hoveredSourceMeta: Writable<SourceMeta | null>;

	$: filteredSourceMetaItems = filterSelectedMetaItems(sourceTree, selectedBuildNames);
</script>

{#each filteredSourceMetaItems as sourceMeta (sourceMeta.cacheId)}
	<SourceMetaExpanderItem {sourceMeta} {selectedSourceMeta} {hoveredSourceMeta} />
{:else}<small><em>no builds selected</em></small>{/each}
