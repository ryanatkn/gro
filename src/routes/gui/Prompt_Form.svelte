<script lang="ts">
	interface Props {
		onsubmit: (value: string) => void;
	}

	const {onsubmit}: Props = $props();

	let value = $state('');

	let textarea_el: HTMLTextAreaElement | undefined;

	// TODO connect `Claude` to the server data in `src/routes/gui/gui.server.svelte`
</script>

<textarea bind:this={textarea_el} placeholder="prompt" bind:value></textarea>
<button
	type="button"
	onclick={() => {
		if (!value) {
			textarea_el?.focus();
			return;
		}
		onsubmit(value);
	}}>prompt Claude</button
>
