<script lang="ts">
	import {getProjectState} from './projectState';
	import {toRootPath} from './pathHelpers';

	const project = getProjectState();

	export let id: string;

	$: displayed = id.startsWith($project.buildDir) ? toRootPath(id, $project.buildDir) : id;
</script>

<div>{displayed}</div>

<style>
	div {
		color: var(--color_1_text);
		white-space: nowrap;
	}
</style>
