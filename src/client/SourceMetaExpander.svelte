<script lang="ts">
	import type {Writable} from 'svelte/store';

	import SourceMetaExpanderItem from './SourceMetaExpanderItem.svelte';
	import {filterSelectedMetas} from './sourceTree';
	import type {SourceTree} from 'src/client/sourceTree.js';
	import type {SourceMeta} from 'src/build/sourceMeta.js';

	export let sourceTree: SourceTree;
	export let selectedBuildNames: string[];
	export let selectedSourceMeta: Writable<SourceMeta | null>;
	export let hoveredSourceMeta: Writable<SourceMeta | null>;

	$: filteredSourceMetas = filterSelectedMetas(sourceTree, selectedBuildNames);
</script>

{#each filteredSourceMetas as sourceMeta (sourceMeta.cacheId)}
	<SourceMetaExpanderItem {sourceMeta} {selectedSourceMeta} {hoveredSourceMeta} />
{:else}<small><em>no builds selected</em></small>{/each}
