<script lang="ts">
	import type {BuildName} from 'src/build/buildConfig.js';

	export let buildName: BuildName;
</script>

<span>{buildName}</span>

<style>
	span {
		color: var(--color_2_text);
		white-space: nowrap;
	}
</style>
