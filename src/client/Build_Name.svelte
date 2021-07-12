<script lang="ts">
	import type {Build_Name} from 'src/build/build_config.js';

	export let build_name: Build_Name;
</script>

<span>{build_name}</span>

<style>
	span {
		color: var(--color_2_text);
		white-space: nowrap;
	}
</style>
