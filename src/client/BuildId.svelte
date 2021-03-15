<script lang="ts">
	import {useProjectState} from './projectState.js';
	import {toRootPath} from './pathHelpers.js';

	const ps = useProjectState();

	export let id: string;

	$: displayed = id.startsWith($ps.buildDir) ? toRootPath(id, $ps.buildDir) : id;
</script>

<div class="build-id">{displayed}</div>

<style>
	.build-id {
		color: var(--color_1_text);
		white-space: nowrap;
	}
</style>
