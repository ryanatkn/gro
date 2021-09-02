<script lang="ts">
	import SourceMetaBuildTreeExplorer from './SourceMetaBuildTreeExplorer.svelte';
	import SourceMetaTreeExplorer from './SourceMetaTreeExplorer.svelte';
	import type {SourceTree} from 'src/client/sourceTree.js';

	export let sourceTree: SourceTree;
	export let selectedBuildNames: string[];
	export const selectedSourceMeta = undefined;
	export const hoveredSourceMeta = undefined;
</script>

<div class="explorers">
	<SourceMetaBuildTreeExplorer {sourceTree} {selectedBuildNames} />
	<SourceMetaTreeExplorer {sourceTree} {selectedBuildNames} />
</div>

<style>
	.explorers {
		display: flex;
	}
</style>
