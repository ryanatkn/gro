<script lang="ts">
	import type {Writable} from 'svelte/store';

	import Build_Name from './Build_Name.svelte';
	import Platform_Name from './Platform_Name.svelte';
	import {get_metas_by_build_name} from './source_tree.js';
	import type {Source_Tree} from './source_tree.js';
	import type {View} from './view.js';
	import type {Source_Meta} from '../build/source_meta.js';

	export let source_tree: Source_Tree;
	export let selected_build_names: string[];
	export let active_source_meta_view: View;
	export let selected_source_meta: Writable<Source_Meta | null>;
	export let hovered_source_meta: Writable<Source_Meta | null>;
</script>

<div class="source-meta">
	<form>
		{#each source_tree.build_configs as build_config (build_config.name)}
			<div>
				<label>
					<input type="checkbox" bind:group={selected_build_names} value={build_config.name} />
					<Build_Name build_name={build_config.name} />
					<small>
						({get_metas_by_build_name(source_tree, build_config.name).length})

						<Platform_Name platform_name={build_config.platform} />
					</small>
				</label>
			</div>
		{/each}
	</form>
	<svelte:component
		this={active_source_meta_view}
		{source_tree}
		{selected_source_meta}
		{hovered_source_meta}
		{selected_build_names}
	/>
</div>
