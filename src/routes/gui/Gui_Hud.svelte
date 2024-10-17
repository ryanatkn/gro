<script lang="ts">
	import type {Gui} from './gui.svelte.js';
	import File_List from './File_List.svelte';
	import Prompt_Form from './Prompt_Form.svelte';

	interface Props {
		gui: Gui;
	}

	const {gui}: Props = $props();

	const {pending_prompts} = $derived(gui);

	let claude_text = $state('');
	let chatgpt_text = $state('');
	let gemini_text = $state('');
</script>

<h1>gro gui dashboard</h1>

<section>
	<Prompt_Form
		name="claude"
		onsubmit={(text) => {
			void gui.send_prompt(text);
			claude_text = text;
		}}
		pending={pending_prompts.has(claude_text)}
	/>
	<Prompt_Form
		name="chatgpt"
		onsubmit={(text) => {
			void gui.send_prompt(text);
			chatgpt_text = text;
		}}
		pending={pending_prompts.has(chatgpt_text)}
	/>
	<Prompt_Form
		name="gemini"
		onsubmit={(text) => {
			void gui.send_prompt(text);
			gemini_text = text;
		}}
		pending={pending_prompts.has(gemini_text)}
	/>
</section>
<File_List files={gui.files_by_id} />
