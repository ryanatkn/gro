<script lang="ts">
	import type {Build_Name} from '../build/build_config.js';

	export let build_name: Build_Name;
</script>

<span class="build-name">{build_name}</span>

<style>
	.build-name {
		color: var(--color_2_text);
		white-space: nowrap;
	}
</style>
