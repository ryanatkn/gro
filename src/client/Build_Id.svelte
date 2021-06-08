<script lang="ts">
	import {use_project_state} from './project_state.js';
	import {to_root_path} from './path_helpers.js';

	const ps = use_project_state();

	export let id: string;

	$: displayed = id.startsWith($ps.build_dir) ? to_root_path(id, $ps.build_dir) : id;
</script>

<div>{displayed}</div>

<style>
	div {
		color: var(--color_1_text);
		white-space: nowrap;
	}
</style>
