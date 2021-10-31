<script lang="ts">
	import type {View} from '$lib/app/view.js';

	// TODO maybe change this data structure?
	// just accept a string? class name in a registry? a file path? url?
	export let view: View;
</script>

<span class="view-name">{view.name}</span>

<style>
	.view-name {
		color: var(--color_3_text);
		white-space: nowrap;
	}
</style>
