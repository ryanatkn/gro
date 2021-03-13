<script lang="ts">
	export let platformName: string;
</script>

<span class="platform-name">{platformName}</span>

<style>
	.platform-name {
		color: var(--color_4_text);
		white-space: nowrap;
	}
</style>
