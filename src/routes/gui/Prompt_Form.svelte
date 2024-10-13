<script lang="ts">
	interface Props {
		onsubmit: (value: string) => void;
	}

	const {onsubmit}: Props = $props();

	let value = $state('');

	let input_el: HTMLInputElement | undefined;
</script>

<input bind:this={input_el} type="text" placeholder="prompt" bind:value />
<button
	type="button"
	onclick={() => {
		if (!value) {
			input_el?.focus();
			return;
		}
		onsubmit(value);
	}}>submit prompt</button
>
