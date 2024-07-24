<script lang="ts" context="module">
	export const a = 'ok';
</script>

<script lang="ts">
	interface Props {
		b: string;
	}

	const {b = 'ok'}: Props = $props();

	// `
	// ``
	// ```
	`backticks`;
	('`');
	('``');
	('```');
	`\``;
	`\`\``;
	`\`\`\``;
</script>

Some_Test_Svelte.svelte contents

{a}

{b}

` `` ```
<!-- ` -->
<!-- `` -->
<!-- ``` -->
{`backticks`}
{'`'}
{'``'}
{'```'}
{`\``}
{`\`\``}
{`\`\`\``}
