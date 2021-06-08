<script lang="ts">
	import {useProjectState} from './projectState.js';
	import {to_root_path} from './pathHelpers.js';

	const ps = useProjectState();

	export let id: string;

	$: displayed = id.startsWith($ps.build_dir) ? to_root_path(id, $ps.build_dir) : id;
</script>

<div class="build-id">{displayed}</div>

<style>
	.build-id {
		color: var(--color_1_text);
		white-space: nowrap;
	}
</style>
