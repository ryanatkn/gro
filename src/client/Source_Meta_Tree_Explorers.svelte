<script lang="ts">
	import SourceMetaBuildTreeExplorer from './SourceMetaBuildTreeExplorer.svelte';
	import SourceMetaTreeExplorer from './SourceMetaTreeExplorer.svelte';
	import type {SourceTree} from './sourceTree.js';

	export let sourceTree: SourceTree;
	export let selectedBuild_Names: string[];
	export const selectedSourceMeta = undefined;
	export const hoveredSourceMeta = undefined;
</script>

<div class="explorers">
	<SourceMetaBuildTreeExplorer {sourceTree} {selectedBuild_Names} />
	<SourceMetaTreeExplorer {sourceTree} {selectedBuild_Names} />
</div>

<style>
	.explorers {
		display: flex;
	}
</style>
