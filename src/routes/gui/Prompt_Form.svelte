<script lang="ts">
	interface Props {
		onsubmit: (value: string) => void;
	}

	const {onsubmit}: Props = $props();

	let value = '';
</script>

<input type="text" placeholder="prompt" bind:value />
<button onclick={() => onsubmit(value)}>submit prompt</button>
