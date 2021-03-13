<script lang="ts">
	export let buildName: string;
</script>

<span class="build-name">{buildName}</span>

<style>
	.build-name {
		color: var(--color_2_text);
		white-space: nowrap;
	}
</style>
