<script lang="ts">
	import type {BuildName} from '../config/buildConfig';

	export let buildName: BuildName;
</script>

<span class="build-name">{buildName}</span>

<style>
	.build-name {
		color: var(--color_2_text);
		white-space: nowrap;
	}
</style>
