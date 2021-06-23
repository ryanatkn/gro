<script lang="ts">
	import {get_project_state} from './project_state.js';
	import {to_root_path} from './path_helpers.js';

	const project = get_project_state();

	export let id: string;

	$: displayed = id.startsWith($project.build_dir) ? to_root_path(id, $project.build_dir) : id;
</script>

<div>{displayed}</div>

<style>
	div {
		color: var(--color_1_text);
		white-space: nowrap;
	}
</style>
