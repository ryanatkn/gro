<script lang="ts">
	import type {BuildName} from 'src/build/build_config.js';

	export let build_name: BuildName;
</script>

<span>{build_name}</span>

<style>
	span {
		color: var(--color_2_text);
		white-space: nowrap;
	}
</style>
