<script lang="ts">
	import type {BuildName} from '../build/buildConfig.js';

	export let buildName: BuildName;
</script>

<span class="build-name">{buildName}</span>

<style>
	.build-name {
		color: var(--color_2_text);
		white-space: nowrap;
	}
</style>
