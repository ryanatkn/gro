<script lang="ts">
	import Pending_Button from '@ryanatkn/fuz/Pending_Button.svelte';

	interface Props {
		name: string;
		onsubmit: (value: string) => void;
		pending: boolean;
	}

	const {name, onsubmit, pending}: Props = $props();

	let value = $state('');

	let textarea_el: HTMLTextAreaElement | undefined;

	// TODO connect `Claude` to the server data in `src/routes/gui/gui.server.svelte`

	const agents = [
		{name: 'claude', title: 'Claude', model: 'todo'},
		{name: 'chatgpt', title: 'ChatGPT', model: 'todo'},
		{name: 'gemini', title: 'Gemini', model: 'todo'},
	] as const;

	const agent = $derived(agents.find((agent) => agent.name === name));
</script>

<textarea bind:this={textarea_el} placeholder="prompt" bind:value></textarea>
<Pending_Button
	{pending}
	onclick={() => {
		if (!value) {
			textarea_el?.focus();
			return;
		}
		onsubmit(value);
	}}
	>{#if agent}prompt {agent.title}{:else}unknown agent {name}{/if}</Pending_Button
>
